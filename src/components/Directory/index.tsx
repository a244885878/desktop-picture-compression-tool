import { useEffect, useCallback, useRef } from "react";
import styles from "./index.module.scss";
import { useImmer } from "use-immer";
import { FileItemTypeEnum, type FileItem, type BreadcrumbList } from "@/types";
import {
  Empty,
  Breadcrumb,
  Image,
  Dropdown,
  Checkbox,
  Button,
  Modal,
  App,
  Skeleton,
} from "antd";
import type { MenuProps } from "antd";
import { DropdownMenuEnum } from "@/types";
import RenameModal from "@/components/RenameModal";
import CompressedFilesModal from "../CompressedFilesModal";
import ConvertFilesModal from "../ConvertFilesModal";
import WatermarkModal from "../WatermarkModal";
import CropModal from "../CropModal";
import DetailsModal from "../DetailsModal";

const Directory: React.FC = () => {
  const [list, setList] = useImmer<FileItem[]>([]); // 列表数据
  const [isEmpty, setIsEmpty] = useImmer(false); // 是否为空
  const [breadcrumb, setBreadcrumb] = useImmer<BreadcrumbList>([]); // 面包屑
  const [batchOperation, setBatchOperation] = useImmer(false); // 是否开启批量操作
  const [selectedFiles, setSelectedFiles] = useImmer<FileItem[]>([]); // 选中的文件(批量操作)
  const [currentPath, setCurrentPath] = useImmer<string | undefined>(undefined); // 当前目录路径
  const [renameModalOpen, setRenameModalOpen] = useImmer(false); // 重命名弹窗是否打开
  const currentFile = useRef<FileItem | undefined>(undefined); // 当前选中的文件
  const [loading, setLoading] = useImmer(false); // 是否加载中
  const [compressedFilesModalOpen, setCompressedFilesModalOpen] =
    useImmer(false); // 压缩文件弹窗是否打开
  const [convertFilesModalOpen, setConvertFilesModalOpen] = useImmer(false); // 转换文件弹窗是否打开
  const [watermarkModalOpen, setWatermarkModalOpen] = useImmer(false); // 加水印弹窗是否打开
  const [cropModalOpen, setCropModalOpen] = useImmer(false); // 裁剪弹窗是否打开
  const [detailsModalOpen, setDetailsModalOpen] = useImmer(false); // 详情弹窗是否打开

  const { message } = App.useApp();

  // 下拉菜单
  const getDropdownMenu = (item: FileItem) => {
    const menu: MenuProps["items"] = [
      {
        key: DropdownMenuEnum.DELETE,
        label: <span>删除</span>,
        onClick: () => {
          deleteFile([item.path]);
        },
      },
      {
        key: DropdownMenuEnum.RENAME,
        label: <span>重命名</span>,
        onClick: () => {
          currentFile.current = item;
          setRenameModalOpen(true);
        },
      },
      {
        key: DropdownMenuEnum.COMPRESS,
        label: <span>压缩</span>,
        onClick: () => {
          setSelectedFiles([item]);
          setCompressedFilesModalOpen(true);
        },
      },
      {
        key: DropdownMenuEnum.DETAIL,
        label: <span>详情</span>,
        onClick: async () => {
          if (window.electronAPI) {
            currentFile.current = item;
            setDetailsModalOpen(true);
          }
        },
      },
      {
        key: DropdownMenuEnum.FORMAT_CONVERT,
        label: <span>格式转换</span>,
        onClick: () => {
          setSelectedFiles([item]);
          setConvertFilesModalOpen(true);
        },
      },
      {
        key: DropdownMenuEnum.CROP,
        label: <span>裁剪</span>,
        onClick: () => {
          setSelectedFiles([item]);
          setCropModalOpen(true);
        },
      },
      {
        key: DropdownMenuEnum.WATERMARK,
        label: <span>加水印</span>,
        onClick: () => {
          setSelectedFiles([item]);
          setWatermarkModalOpen(true);
        },
      },
    ];
    return menu;
  };

  // 获取目录
  const getDirectory = useCallback(
    async (path?: string) => {
      if (window.electronAPI) {
        setLoading(true);
        setCurrentPath(path);
        setBatchOperation(false);
        try {
          const res = await window.electronAPI.getDirectoryContents(path);
          setList(res);
          if (!res.length) setIsEmpty(true);
          else setIsEmpty(false);
          const breadcrumbList = window.electronAPI.getBreadcrumbList(path);
          setBreadcrumb(breadcrumbList);
        } finally {
          setLoading(false);
        }
      }
    },
    [
      setCurrentPath,
      setList,
      setIsEmpty,
      setBreadcrumb,
      setLoading,
      setBatchOperation,
    ]
  );

  // 记录选中的文件
  const handleCheckboxChange = (item: FileItem, checked: boolean) => {
    if (checked) {
      if (selectedFiles.length >= 10) {
        message.warning("为避免可能出现的性能问题，一次最多勾选10个文件");
        return;
      }
      const next = [...selectedFiles, item];
      setSelectedFiles(next);
    } else {
      setSelectedFiles(selectedFiles.filter((file) => file.path !== item.path));
    }
  };

  // 点击批量操作
  const handleBatchOperationChange = () => {
    setSelectedFiles([]);
    setBatchOperation(!batchOperation);
  };

  // 删除文件
  const deleteFile = (files: string[]) => {
    if (window.electronAPI) {
      Modal.confirm({
        title: "确认删除吗？",
        content: "删除后将无法恢复，请谨慎操作。",
        okText: "确认",
        cancelText: "取消",
        maskClosable: false,
        keyboard: false,
        async onOk() {
          setLoading(true);
          try {
            const success = await window.electronAPI?.deleteFile(files);
            if (success) {
              message.success("删除成功");
              await getDirectory(currentPath);
              setSelectedFiles((draft) => {
                return draft.filter((file) => !files.includes(file.path));
              });
            } else {
              message.error("删除失败");
            }
          } finally {
            setLoading(false);
          }
        },
      });
    }
  };

  // 刷新列表
  const refreshList = () => {
    setBatchOperation(false);
    getDirectory(currentPath);
  };

  useEffect(() => {
    getDirectory();
  }, [getDirectory]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<string>;
      const p = ce.detail;
      if (p && typeof p === "string") {
        getDirectory(p);
      }
    };
    window.addEventListener("refresh-directory", handler as EventListener);
    return () => window.removeEventListener("refresh-directory", handler as EventListener);
  }, [getDirectory]);

  // 动态显示文件类型
  const showFileType = (item: FileItem, index: number) => {
    // 文件夹
    if (item.type === FileItemTypeEnum.FOLDER) {
      return (
        <div
          className={styles.fileBox}
          key={index}
          onDoubleClick={() => getDirectory(item.path)}
        >
          <div className={styles.folderItem}></div>
          <div className={styles.fileName}>{item.name}</div>
        </div>
      );
    }
    // 图片
    if (item.type === FileItemTypeEnum.IMAGE) {
      // 使用文件路径转换为 URL，而不是 base64
      const imageUrl = window.electronAPI?.getFileUrl
        ? window.electronAPI.getFileUrl(item.path)
        : item.path;
      
      return (
        <Dropdown
          menu={{ items: getDropdownMenu(item) }}
          trigger={["contextMenu"]}
          key={index}
        >
          <div className={styles.fileBox}>
            <div className={styles.imgBox}>
              <Image
                src={imageUrl}
                className={styles.img}
                loading="lazy"
                placeholder={
                  <Skeleton.Image
                    active
                    style={{ width: "100%", height: "100%" }}
                  />
                }
              />
              {batchOperation && (
                <Checkbox
                  onChange={(e) => handleCheckboxChange(item, e.target.checked)}
                  className={styles.checkbox}
                  style={{
                    transform: "scale(2)",
                    transformOrigin: "0 0",
                  }}
                  checked={selectedFiles.some(
                    (file) => file.path === item.path
                  )}
                ></Checkbox>
              )}
            </div>
            <div className={styles.fileName}>{item.name}</div>
          </div>
        </Dropdown>
      );
    }
  };

  return (
    <div className={styles.directoryContainer}>
      {/* 面包屑 */}
      <div className={styles.headerBox}>
        <Breadcrumb
          separator=">"
          items={breadcrumb.map((item) => ({
            title: item.title,
            path: item.path,
            onClick: () => {
              getDirectory(item.path);
            },
          }))}
        />
        <Checkbox
          checked={batchOperation}
          onChange={handleBatchOperationChange}
        >
          批量操作
        </Checkbox>
      </div>
      {/* 目录列表 */}
      <div className={styles.directoryItemList}>
        {loading ? (
          Array.from({ length: 12 }).map((_, index) => (
            <div className={styles.fileBox} key={index}>
              <div className={styles.imgBox}>
                <Skeleton.Image active style={{ width: 100, height: 100 }} />
              </div>
              <Skeleton
                active
                title={false}
                paragraph={{ rows: 1, width: 100 }}
              />
            </div>
          ))
        ) : isEmpty ? (
          <div className={styles.emptyContainer}>
            <Empty />
          </div>
        ) : (
          list.map((item, index) => showFileType(item, index))
        )}
      </div>
      {/* 批量操作 */}
      {batchOperation && (
        <div className={styles.batchOperationBox}>
          <span>当前已选择</span>
          <span style={{ color: "#40a9ff" }}>{selectedFiles.length}</span>
          <span>个文件</span>
          {selectedFiles.length > 0 && (
            <div className={styles.batchOperationButtonBox}>
              <Button
                color="primary"
                variant="text"
                onClick={() => deleteFile(selectedFiles.map((v) => v.path))}
              >
                批量删除
              </Button>
              <Button
                color="primary"
                variant="text"
                onClick={() => setCompressedFilesModalOpen(true)}
              >
                批量压缩
              </Button>
              <Button
                color="primary"
                variant="text"
                onClick={() => setConvertFilesModalOpen(true)}
              >
                批量格式转换
              </Button>
              
            </div>
          )}
        </div>
      )}
      {/* 重命名弹窗 */}
      <RenameModal
        open={renameModalOpen}
        onOk={refreshList}
        file={currentFile.current!}
        onCancel={() => setRenameModalOpen(false)}
      />
      {/* 压缩文件弹窗 */}
      <CompressedFilesModal
        open={compressedFilesModalOpen}
        currentDirectory={currentPath!}
        onOk={refreshList}
        onCancel={() => setCompressedFilesModalOpen(false)}
        selectedFiles={selectedFiles}
      />
      {/* 转换文件格式弹窗 */}
      <ConvertFilesModal
        open={convertFilesModalOpen}
        currentDirectory={currentPath!}
        onOk={refreshList}
        onCancel={() => setConvertFilesModalOpen(false)}
        selectedFiles={selectedFiles}
      />
      <WatermarkModal
        open={watermarkModalOpen}
        currentDirectory={currentPath!}
        onOk={refreshList}
        onCancel={() => setWatermarkModalOpen(false)}
        selectedFiles={selectedFiles}
      />
      <CropModal
        open={cropModalOpen}
        currentDirectory={currentPath!}
        onOk={refreshList}
        onCancel={() => setCropModalOpen(false)}
        selectedFiles={selectedFiles}
      />
      {/* 详情弹窗 */}
      <DetailsModal
        open={detailsModalOpen}
        onOk={() => setDetailsModalOpen(false)}
        onCancel={() => setDetailsModalOpen(false)}
        file={currentFile.current!}
      />
    </div>
  );
};

export default Directory;
