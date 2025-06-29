import React, { useState, useEffect } from "react";
import styles from "./index.module.scss";
import { Breadcrumb, Button, ConfigProvider, App } from "antd";
import type { DirData } from "../../../electron/types";
import FileList from "./components/FileList";
import CompressPictureDialog from "./components/CompressPictureDialog";

const AppComponent: React.FC = () => {
  const { message, modal } = App.useApp();
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);
  const [items, setItems] = useState<DirData["items"]>([]);
  const [selectedItems, setSelectedItems] = useState<DirData["items"]>([]);
  const [showCompressPictureDialog, setShowCompressPictureDialog] =
    useState(false);
  const [currentDirectory, setCurrentDirectory] = useState<string>("");

  useEffect(() => {
    // 获取目录数据
    window.electronAPI.receive("directory-data", (dirData: DirData) => {
      setBreadcrumb(dirData.breadcrumb);
      setItems(dirData.items);

      // 根据面包屑构建当前目录路径
      setCurrentDirectory(buildPathFromBreadcrumb(dirData.breadcrumb));
    });

    // 处理错误消息
    window.electronAPI.receive(
      "directory-data-error",
      (msg: { error: string }) => {
        message.error(`获取目录数据失败: ${msg.error}`);
      }
    );
  }, [message]);

  // 根据面包屑索引构建路径
  const getBreadcrumbPath = (index: number) => {
    if (index === 0) {
      // 第一个面包屑项，返回根路径
      return "";
    }

    // 构建到指定索引的路径
    const pathParts = breadcrumb.slice(0, index + 1);

    // 对于macOS/Linux，如果第一个是"/"，则从第二个开始构建
    if (pathParts[0] === "/") {
      return "/" + pathParts.slice(1).join("/");
    }

    return pathParts.join("/");
  };

  // 根据面包屑数组构建完整路径
  const buildPathFromBreadcrumb = (breadcrumbArray: string[]) => {
    if (breadcrumbArray.length === 0) {
      return "";
    }

    // 对于macOS/Linux，如果第一个是"/"，则从第二个开始构建
    if (breadcrumbArray[0] === "/") {
      return "/" + breadcrumbArray.slice(1).join("/");
    }

    return breadcrumbArray.join("/");
  };

  // 点击压缩图片按钮
  const handleCompressPicture = () => {
    if (selectedItems.length === 0) {
      message.warning("请先选中要压缩的图片");
      return;
    }
    setShowCompressPictureDialog(true);
  };

  // 刷新列表
  const refreshList = () => {
    // 重新获取当前目录数据
    window.electronAPI.send("get-directory-data", currentDirectory);
    // 清空选中的文件列表
    setSelectedItems([]);
  };

  // 压缩完成
  const handleOk = () => {
    setShowCompressPictureDialog(false);
    refreshList();
  };

  // 删除
  const handleDelete = () => {
    if (selectedItems.length === 0) {
      message.warning("请先选中要删除的图片");
      return;
    }

    // 显示确认对话框
    modal.confirm({
      title: "确认删除",
      content: `确定要删除选中的 ${selectedItems.length} 个文件吗？此操作不可恢复。`,
      okText: "确定删除",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        try {
          const result = await window.electronAPI.deleteFiles(selectedItems);

          if (result.success) {
            message.success(`成功删除 ${selectedItems.length} 个文件`);
            refreshList();
          } else {
            message.error(`删除失败: ${result.error}`);
          }
        } catch (error) {
          console.error("删除文件失败:", error);
          message.error("删除文件时发生错误");
        }
      },
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbBox}>
        <Breadcrumb
          items={breadcrumb.map((item, index) => ({
            title: item,
            onClick() {
              const path = getBreadcrumbPath(index);
              window.electronAPI.send("get-directory-data", path);
            },
          }))}
        />
        <div className={styles.handleBox}>
          <ConfigProvider
            theme={{
              components: {
                Button: { paddingInline: 8 },
              },
            }}
          >
            <Button
              color="primary"
              variant="link"
              onClick={handleCompressPicture}
            >
              压缩图片
            </Button>
            <Button color="primary" variant="link">
              格式转换
            </Button>
            <Button color="danger" variant="link" onClick={handleDelete}>
              删除
            </Button>
          </ConfigProvider>
        </div>
      </div>
      <FileList
        items={items}
        selectedItems={selectedItems}
        setSelectedItems={setSelectedItems}
      />
      <div className={styles.selectedText}>
        已选中 {selectedItems.length} 个图片
      </div>
      <CompressPictureDialog
        show={showCompressPictureDialog}
        onClose={() => setShowCompressPictureDialog(false)}
        onOk={() => handleOk()}
        selectedItems={selectedItems}
        currentDirectory={currentDirectory}
      />
    </div>
  );
};

export default AppComponent;
