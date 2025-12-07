import type { FileItem } from "@/types";
import {
  App,
  Checkbox,
  Form,
  InputNumber,
  Modal,
  Tag,
  type ModalProps,
} from "antd";
import React, { useEffect, useMemo, useRef, useState } from "react";
import SelectDir from "../SelectDir";

export interface CropModalProps extends ModalProps {
  open: boolean;
  onOk?: () => void;
  onCancel?: () => void;
  selectedFiles: FileItem[];
  currentDirectory: string;
}

export type FormType = {
  outputDir: string;
  isUseCurrentDir: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
};

const CropModal: React.FC<CropModalProps> = ({
  open,
  onOk,
  onCancel,
  selectedFiles,
  currentDirectory,
  ...rest
}) => {
  const [form] = Form.useForm<FormType>();
  const isUseCurrentDir = Form.useWatch("isUseCurrentDir", form);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const { message } = App.useApp();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [displaySize, setDisplaySize] = useState<{
    w: number;
    h: number;
    ox: number;
    oy: number;
    nw: number;
    nh: number;
    scale: number;
  }>({ w: 0, h: 0, ox: 0, oy: 0, nw: 0, nh: 0, scale: 1 });
  const [cropArea, setCropArea] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>({ x: 0, y: 0, width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const previewSrc = useMemo(() => {
    if (!selectedFiles[0]) return undefined;
    // 使用 getFileUrl 获取图片 URL（预览使用原图）
    return window.electronAPI?.getFileUrl
      ? window.electronAPI.getFileUrl(selectedFiles[0].path, false)
      : selectedFiles[0].path;
  }, [selectedFiles]);

  const onFinish = async (values: FormType) => {
    if (!window.electronAPI) return;
    if (values.isUseCurrentDir) {
      values.outputDir = currentDirectory;
    }
    if (selectedFiles.length !== 1) {
      message.warning("请先选择一张图片");
      return;
    }
    if (values.width <= 0 || values.height <= 0) {
      message.warning("裁剪区域宽度和高度必须大于0");
      return;
    }
    setConfirmLoading(true);
    try {
      const res = await window.electronAPI.cropImage(
        selectedFiles[0],
        values.outputDir,
        {
          left: values.left,
          top: values.top,
          width: values.width,
          height: values.height,
        }
      );
      setConfirmLoading(false);
      if (res.success) {
        message.success("裁剪成功");
        const outDir = values.isUseCurrentDir
          ? currentDirectory
          : values.outputDir;
        if (outDir) {
          window.dispatchEvent(
            new CustomEvent<string>("refresh-directory", { detail: outDir })
          );
        }
        onOk?.();
        onCancel?.();
      } else {
        message.error(res.result.error || "裁剪失败");
      }
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setConfirmLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        isUseCurrentDir: true,
        outputDir: currentDirectory,
        left: 0,
        top: 0,
        width: 0,
        height: 0,
      });
      setCropArea({ x: 0, y: 0, width: 0, height: 0 });
    }
  }, [open, form, currentDirectory]);

  const handleImgLoad = () => {
    const cw = 400;
    const ch = 300;
    const img = imgRef.current;
    if (!img) return;
    const nw = img.naturalWidth || cw;
    const nh = img.naturalHeight || ch;
    const scale = Math.min(cw / nw, ch / nh);
    const w = Math.round(nw * scale);
    const h = Math.round(nh * scale);
    const ox = Math.round((cw - w) / 2);
    const oy = Math.round((ch - h) / 2);
    setDisplaySize({ w, h, ox, oy, nw, nh, scale });

    // 初始化裁剪区域为整个图片
    const initialCrop = {
      x: 0,
      y: 0,
      width: w,
      height: h,
    };
    setCropArea(initialCrop);
    form.setFieldsValue({
      left: 0,
      top: 0,
      width: nw,
      height: nh,
    });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current || !imgRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - displaySize.ox;
    const y = e.clientY - rect.top - displaySize.oy;

    // 检查是否在图片范围内
    if (x < 0 || y < 0 || x > displaySize.w || y > displaySize.h) return;

    setDragStart({ x, y });
    setDragging(true);
    setCropArea({ x, y, width: 0, height: 0 });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !dragStart || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left - displaySize.ox;
    const currentY = e.clientY - rect.top - displaySize.oy;

    // 限制在图片范围内
    const minX = Math.max(0, Math.min(dragStart.x, currentX));
    const minY = Math.max(0, Math.min(dragStart.y, currentY));
    const maxX = Math.min(displaySize.w, Math.max(dragStart.x, currentX));
    const maxY = Math.min(displaySize.h, Math.max(dragStart.y, currentY));

    const width = maxX - minX;
    const height = maxY - minY;

    setCropArea({
      x: minX,
      y: minY,
      width,
      height,
    });

    // 更新表单值（转换为实际图片坐标）
    const actualLeft = Math.round(minX / displaySize.scale);
    const actualTop = Math.round(minY / displaySize.scale);
    const actualWidth = Math.round(width / displaySize.scale);
    const actualHeight = Math.round(height / displaySize.scale);

    form.setFieldsValue({
      left: actualLeft,
      top: actualTop,
      width: actualWidth,
      height: actualHeight,
    });
  };

  const onMouseUp = () => {
    setDragging(false);
    setDragStart(null);
  };

  return (
    <Modal
      {...rest}
      title="裁剪图片"
      open={open}
      onOk={() => form.submit()}
      onCancel={() => onCancel?.()}
      maskClosable={false}
      keyboard={false}
      okButtonProps={{ disabled: selectedFiles.length !== 1 }}
      confirmLoading={confirmLoading}
      width={600}
    >
      <Form layout="vertical" form={form} onFinish={onFinish}>
        <Form.Item<FormType> label="已选文件">
          <div
            style={{
              maxHeight: "300px",
              overflowY: "auto",
            }}
          >
            {selectedFiles[0] && (
              <Tag
                bordered={false}
                color="processing"
                key={selectedFiles[0].path}
              >
                {selectedFiles[0].name}
              </Tag>
            )}
          </div>
        </Form.Item>
        <Form.Item<FormType> label="预览（拖拽选择裁剪区域）">
          <div
            style={{
              position: "relative",
              border: "1px solid #eee",
              borderRadius: 8,
              width: 400,
              height: 300,
              overflow: "hidden",
              background: "#fafafa",
              cursor: dragging ? "crosshair" : "default",
            }}
            ref={containerRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            {previewSrc && (
              <img
                src={previewSrc}
                style={{
                  width: `${displaySize.w}px`,
                  height: `${displaySize.h}px`,
                  objectFit: "contain",
                  position: "absolute",
                  left: `${displaySize.ox}px`,
                  top: `${displaySize.oy}px`,
                }}
                ref={imgRef}
                onLoad={handleImgLoad}
                draggable={false}
              />
            )}
            {cropArea.width > 0 && cropArea.height > 0 && (
              <>
                <div
                  style={{
                    position: "absolute",
                    left: `${displaySize.ox + cropArea.x}px`,
                    top: `${displaySize.oy + cropArea.y}px`,
                    width: `${cropArea.width}px`,
                    height: `${cropArea.height}px`,
                    border: "2px solid #1890ff",
                    background: "rgba(24, 144, 255, 0.1)",
                    pointerEvents: "none",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: `${displaySize.ox + cropArea.x}px`,
                    top: `${displaySize.oy + cropArea.y - 20}px`,
                    background: "rgba(0, 0, 0, 0.7)",
                    color: "#fff",
                    padding: "2px 6px",
                    fontSize: "12px",
                    borderRadius: "4px",
                    pointerEvents: "none",
                  }}
                >
                  {Math.round(cropArea.width / displaySize.scale)} ×{" "}
                  {Math.round(cropArea.height / displaySize.scale)}
                </div>
              </>
            )}
          </div>
        </Form.Item>
        <Form.Item<FormType> label="裁剪参数（只读，通过拖拽选择区域）">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Form.Item<FormType>
              label="X坐标"
              name="left"
              style={{ margin: 0, width: 120 }}
            >
              <InputNumber min={0} readOnly style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item<FormType>
              label="Y坐标"
              name="top"
              style={{ margin: 0, width: 120 }}
            >
              <InputNumber min={0} readOnly style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item<FormType>
              label="宽度"
              name="width"
              style={{ margin: 0, width: 120 }}
            >
              <InputNumber min={1} readOnly style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item<FormType>
              label="高度"
              name="height"
              style={{ margin: 0, width: 120 }}
            >
              <InputNumber min={1} readOnly style={{ width: "100%" }} />
            </Form.Item>
          </div>
        </Form.Item>
        <Form.Item<FormType>
          label="输出目录"
          name="isUseCurrentDir"
          valuePropName="checked"
        >
          <Checkbox>当前目录</Checkbox>
        </Form.Item>
        {!isUseCurrentDir && (
          <Form.Item<FormType>
            label="选择目录"
            name="outputDir"
            rules={[{ required: true, message: "请选择输出目录" }]}
          >
            <SelectDir />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

export default CropModal;
