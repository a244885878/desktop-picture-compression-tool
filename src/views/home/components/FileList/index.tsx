import React from "react";
import folderImg from "../../../../assets/image/folder.png";
import styles from "./index.module.scss";
import type { DirData } from "../../../../../electron/types";
import { ItemType } from "../../../../../electron/enum";
import { Image, Empty, Checkbox, type CheckboxChangeEvent } from "antd";

const FileList: React.FC<{
  items: DirData["items"];
  selectedItems: DirData["items"];
  setSelectedItems: React.Dispatch<React.SetStateAction<DirData["items"]>>;
}> = ({ items, selectedItems, setSelectedItems }) => {
  // 获取图片预览列表
  const getPreviewUrl = () => {
    return items
      .filter((item) => item.type === ItemType.IMAGE)
      .map((item) => {
        return item.previewUrl;
      });
  };

  // 点击文件
  const handleFile = (item: DirData["items"][number]) => {
    if (item.type === ItemType.FOLDER) {
      window.electronAPI.send("get-directory-data", item.path);
    }
  };

  // 字节单位转换
  const formatBytes = (bytes: number, decimals = 2): string => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);

    return `${parseFloat(value.toFixed(decimals))} ${sizes[i]}`;
  };

  // 选中文件
  const handleCheckboxChange = (
    e: CheckboxChangeEvent,
    item: DirData["items"][number]
  ) => {
    if (e.target.checked) {
      setSelectedItems([...selectedItems, item]);
    } else {
      setSelectedItems(
        selectedItems.filter((selectedItem) => selectedItem.id !== item.id)
      );
    }
  };

  // 显示文件夹或图片
  const showFile = (item: DirData["items"][number]) => {
    if (item.type === ItemType.FOLDER) {
      return (
        <img
          src={folderImg}
          alt={item.name}
          className={styles.fileImg}
          style={{ transform: "scale(1.3)" }}
        />
      );
    } else {
      return (
        <Image.PreviewGroup items={getPreviewUrl()}>
          <Image
            className={styles.fileImg}
            src={item.previewUrl}
            alt={item.name}
          />
        </Image.PreviewGroup>
      );
    }
  };

  // 显示文件列表/空状态
  const showFileList = () => {
    if (items.length === 0) {
      return (
        <div className={styles.emptyContainer}>
          <Empty
            description="暂无文件夹和图片"
            styles={{ image: { height: 200, width: 200 } }}
          />
        </div>
      );
    } else {
      return items.map((item, index) => {
        return (
          <div
            className={styles.fileItem}
            key={index}
            onClick={() => handleFile(item)}
          >
            <div className={styles.fileBox}>
              {showFile(item)}
              {item.type === ItemType.IMAGE && (
                <Checkbox
                  className={styles.checkbox}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => handleCheckboxChange(e, item)}
                  checked={
                    !!selectedItems.find(
                      (selectedItem) => selectedItem.id === item.id
                    )
                  }
                ></Checkbox>
              )}
            </div>
            <div className={styles.fileName}>{item.name}</div>
            <div className={styles.fileSize}>
              {item.type === ItemType.FOLDER
                ? "文件夹"
                : formatBytes(item.size)}
            </div>
          </div>
        );
      });
    }
  };

  return <div className={styles.fileListContainer}>{showFileList()}</div>;
};

export default FileList;
