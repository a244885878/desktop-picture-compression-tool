import { Modal, Radio, App, Slider } from "antd";
import { useState, useEffect } from "react";
import type { DirData } from "../../../../../electron/types";
import styles from "./index.module.scss";

type Props = {
  show: boolean;
  onClose?: () => void;
  onOk?: () => void;
  selectedItems: DirData["items"];
  currentDirectory?: string; // 当前目录路径
};

const CompressPictureDialog: React.FC<Props> = ({
  show,
  onClose,
  onOk,
  selectedItems,
  currentDirectory,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [outputDirectory, setOutputDirectory] = useState("current");
  const [compressOption, setCompressOption] = useState("createCopy");
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressQuality, setCompressQuality] = useState(80);
  const { message } = App.useApp();

  useEffect(() => {
    setIsModalOpen(show);
  }, [show]);

  const handleOk = async () => {
    if (isCompressing) return;

    setIsCompressing(true);

    try {
      // 确定输出目录
      const outputDir = currentDirectory || "";

      // 调用压缩API
      const result = await window.electronAPI.compressPictures({
        imageItems: selectedItems,
        outputDirectory: outputDir,
        quality: compressQuality,
      });

      if (result.success) {
        const successCount =
          result.results?.filter((r) => r.success).length || 0;
        const failCount = (result.results?.length || 0) - successCount;

        if (successCount > 0) {
          message.success(`成功压缩 ${successCount} 张图片`);
        }

        if (failCount > 0) {
          message.error(`${failCount} 张图片压缩失败`);
        }

        setIsModalOpen(false);
        onOk?.();
      } else {
        message.error(`压缩失败: ${result.error}`);
      }
    } catch (error) {
      console.error("压缩过程中发生错误:", error);
      message.error("压缩过程中发生错误");
    } finally {
      setIsCompressing(false);
    }
  };

  const handleCancel = () => {
    if (isCompressing) return;
    setIsModalOpen(false);
    onClose?.();
  };

  return (
    <Modal
      open={isModalOpen}
      onOk={handleOk}
      onCancel={handleCancel}
      maskClosable={false}
      confirmLoading={isCompressing}
      title="图片压缩"
    >
      <div>
        <p className={styles.title}>文件列表</p>
        <div>
          {selectedItems.map((item) => {
            return <div key={item.id}>{item.name}</div>;
          })}
        </div>
        <p className={styles.title}>压缩选项</p>
        <Radio.Group
          value={compressOption}
          options={[
            { value: "createCopy", label: "创建副本" },
            { value: "overwrite", label: "覆盖原图", disabled: true },
          ]}
          onChange={(e) => setCompressOption(e.target.value)}
        />
        <p className={styles.title}>压缩质量</p>
        <Slider
          min={1}
          max={100}
          value={compressQuality}
          onChange={(value) => setCompressQuality(value)}
        />
        <p className={styles.title}>输出目录</p>
        <Radio.Group
          value={outputDirectory}
          options={[
            { value: "current", label: "当前目录" },
            { value: "specified", label: "指定目录", disabled: true },
          ]}
          onChange={(e) => setOutputDirectory(e.target.value)}
        />
      </div>
    </Modal>
  );
};

export default CompressPictureDialog;
