import React, { useState, useEffect } from "react";
import styles from "./index.module.scss";
import { Breadcrumb, message } from "antd";
import type { DirData } from "../../../electron/types";
import FileList from "./components/FileList";

const App: React.FC = () => {
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);
  const [items, setItems] = useState<DirData["items"]>([]);

  useEffect(() => {
    // 获取目录数据
    window.electronAPI.receive("directory-data", (dirData: DirData) => {
      setBreadcrumb(dirData.breadcrumb);
      setItems(dirData.items);
    });

    // 处理错误消息
    window.electronAPI.receive(
      "directory-data-error",
      (msg: { error: string }) => {
        message.error(`获取目录数据失败: ${msg.error}`);
      }
    );
  }, []);

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

  return (
    <div className={styles.page}>
      <Breadcrumb
        items={breadcrumb.map((item, index) => ({
          title: item,
          onClick() {
            const path = getBreadcrumbPath(index);
            window.electronAPI.send("get-directory-data", path);
          },
        }))}
      />
      <FileList items={items}></FileList>
    </div>
  );
};

export default App;
