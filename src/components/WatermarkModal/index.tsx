import type { FileItem } from "@/types";
import {
  App,
  Checkbox,
  ColorPicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Tag,
  type ModalProps,
} from "antd";
import React, { useEffect, useMemo, useRef, useState } from "react";
import SelectDir from "../SelectDir";

export interface WatermarkModalProps extends ModalProps {
  open: boolean;
  onOk?: () => void;
  onCancel?: () => void;
  selectedFiles: FileItem[];
  currentDirectory: string;
}

export type FormType = {
  outputDir: string;
  watermarkText: string;
  isUseCurrentDir: boolean;
  fontSize?: number;
  color?: string;
  angle?: number;
  xRatio?: number;
  yRatio?: number;
};

const WatermarkModal: React.FC<WatermarkModalProps> = ({
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
  const wmText = Form.useWatch("watermarkText", form);
  const wmColor = Form.useWatch("color", form);
  const wmSize = Form.useWatch("fontSize", form);
  const wmAngle = Form.useWatch("angle", form) ?? 0;
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
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number }>({
    x: 0.9,
    y: 0.9,
  });
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
      message.warning("请先选择文件");
      return;
    }
    setConfirmLoading(true);
    try {
      const res = await window.electronAPI.addWatermarks(
        [selectedFiles[0]],
        values.watermarkText,
        values.outputDir,
        {
          fontSize: values.fontSize,
          color: values.color,
          angle: values.angle,
          xRatio: dragPos.x,
          yRatio: dragPos.y,
        }
      );
      const ok = res.success;
      if (!ok) {
        const failed = res.results.filter((r) => !r.success).length;
        if (failed > 0) {
          message.error(`有 ${failed} 个文件加水印失败`);
        }
      }
      setConfirmLoading(false);
      if (res.success) {
        message.success("加水印成功");
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
        watermarkText: "",
        color: "rgba(255,255,255,0.75)",
        angle: 0,
      });
      setDragPos({ x: 0.9, y: 0.9 });
    }
  }, [open, form, currentDirectory]);

  const handleImgLoad = () => {
    const cw = 320;
    const ch = 240;
    const img = imgRef.current;
    if (!img || !containerRef.current) return;
    const nw = img.naturalWidth || cw;
    const nh = img.naturalHeight || ch;

    // 计算缩放比例（与图片实际渲染方式一致）
    // 使用 Math.min 确保图片完整显示在容器内（objectFit: contain 的行为）
    const scale = Math.min(cw / nw, ch / nh);
    const w = nw * scale;
    const h = nh * scale;

    // 使用 requestAnimationFrame 确保图片完全渲染后再获取实际位置
    requestAnimationFrame(() => {
      if (!img || !containerRef.current) return;
      const imgRect = img.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();

      // 使用实际渲染位置，但使用计算的尺寸和 scale（确保一致性）
      const actualOx = imgRect.left - containerRect.left;
      const actualOy = imgRect.top - containerRect.top;

      setDisplaySize({
        w,
        h,
        ox: actualOx,
        oy: actualOy,
        nw,
        nh,
        scale,
      });
    });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !imgRef.current) return;

    // 获取图片的实际渲染位置和尺寸
    const imgRect = imgRef.current.getBoundingClientRect();

    // 计算鼠标相对于图片左上角的位置（显示坐标，像素）
    const x = e.clientX - imgRect.left;
    const y = e.clientY - imgRect.top;

    // 限制在图片实际渲染范围内
    const cx = Math.max(0, Math.min(imgRect.width, x));
    const cy = Math.max(0, Math.min(imgRect.height, y));

    // 计算基于原图尺寸的比例（0-1），确保与实际输出一致
    // 显示坐标 cx 对应原图坐标 = cx / scale
    // 原图比例 = (cx / scale) / nw = cx / (nw * scale) = cx / displaySize.w
    // 因为 displaySize.w = nw * scale，所以 dragPos.x = cx / displaySize.w
    // 这个比例是基于原图的，后端会使用：x = Math.round(width * dragPos.x)
    const xr = displaySize.w && displaySize.nw ? cx / displaySize.w : 0;
    const yr = displaySize.h && displaySize.nh ? cy / displaySize.h : 0;

    // 确保比例在 0-1 范围内
    const clampedXr = Math.max(0, Math.min(1, xr));
    const clampedYr = Math.max(0, Math.min(1, yr));

    setDragPos({ x: clampedXr, y: clampedYr });
  };

  const onMouseUp = () => setDragging(false);

  // 计算预览时的字体大小（需要根据显示缩放比例调整）
  // 与后端保持一致：fontDefault = Math.max(16, Math.round(Math.min(width, height) * 0.05))
  const previewFontPx = useMemo(() => {
    if (!displaySize.nw || !displaySize.nh || !displaySize.scale) return 16;
    const naturalMin = Math.min(displaySize.nw, displaySize.nh);
    // 与后端计算方式完全一致
    const defaultFont = Math.max(16, Math.round(naturalMin * 0.05));
    const base = wmSize && wmSize > 0 ? Math.round(wmSize) : defaultFont;
    // 预览时需要使用缩放比例，因为预览图片被缩放了
    // scale 是预览尺寸相对于原图尺寸的比例
    // 字体大小需要按比例缩放，以保持预览效果与实际输出一致
    // 例如：原图 4000px，预览容器 320px，scale = 0.08
    // 输入字体 4000px，预览字体 = 4000 * 0.08 = 320px（在预览中显示）
    // 实际输出 = 4000px（在原图中显示）
    const scaledFont = base * displaySize.scale;
    return Math.max(1, scaledFont);
  }, [wmSize, displaySize]);

  return (
    <Modal
      {...rest}
      title="加水印"
      open={open}
      onOk={() => form.submit()}
      onCancel={() => onCancel?.()}
      maskClosable={false}
      keyboard={false}
      okButtonProps={{ disabled: selectedFiles.length !== 1 }}
      confirmLoading={confirmLoading}
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
        <Form.Item<FormType>
          label="水印文案"
          name="watermarkText"
          rules={[{ required: true, message: "请输入水印文案" }]}
        >
          <Input maxLength={10} placeholder="最多10个字" />
        </Form.Item>

        <Form.Item<FormType> label="文字大小" name="fontSize">
          <InputNumber
            min={8}
            max={10000}
            placeholder="自动"
            style={{ width: "100%" }}
            precision={0}
            parser={(value) => {
              const parsed = value?.replace(/\D/g, "") ?? "";
              return parsed === "" ? "" : Number.parseInt(parsed, 10);
            }}
            formatter={(value) => {
              if (!value) return "";
              return String(Math.floor(Number(value)));
            }}
          />
        </Form.Item>
        <Form.Item<FormType>
          label="颜色"
          name="color"
          getValueFromEvent={(color) => {
            // 从 ColorPicker 的 color 对象中提取 RGB 字符串
            if (color && typeof color === "object" && "toRgbString" in color) {
              return (color as { toRgbString: () => string }).toRgbString();
            }
            return "rgba(255,255,255,0.75)";
          }}
        >
          <ColorPicker />
        </Form.Item>
        <Form.Item<FormType> label="倾斜角度" name="angle">
          <InputNumber
            min={-180}
            max={180}
            placeholder="0"
            style={{ width: "100%" }}
          />
        </Form.Item>
        <Form.Item<FormType> label="预览">
          <div
            style={{
              position: "relative",
              border: "1px solid #eee",
              borderRadius: 8,
              width: 320,
              height: 240,
              overflow: "hidden",
              background: "#fafafa",
            }}
            ref={containerRef}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            {previewSrc && (
              <img
                src={previewSrc}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
                ref={imgRef}
                onLoad={handleImgLoad}
              />
            )}
            {wmText && (
              <div
                style={{
                  position: "absolute",
                  color: wmColor ?? "rgba(255,255,255,0.75)",
                  fontSize: `${previewFontPx}px`,
                  fontFamily: "sans-serif",
                  // 使用与后端一致的文本阴影效果（stroke模拟）
                  textShadow:
                    "0 0 2px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.5)",
                  // 计算位置：确保预览位置与实际输出完全一致
                  // 后端计算：x = Math.round(width * xRatio), y = Math.round(height * yRatio)
                  // dragPos.x 和 dragPos.y 是基于原图的比例（0-1）
                  // 预览位置计算（必须与后端完全一致）：
                  // 1. 原图坐标：x = nw * dragPos.x, y = nh * dragPos.y
                  // 2. 显示坐标：left = ox + x * scale, top = oy + y * scale
                  // 3. 简化：left = ox + nw * dragPos.x * scale = ox + displaySize.w * dragPos.x
                  // 使用精确计算，避免舍入误差累积
                  // 注意：后端使用 Math.round，但预览使用精确值以保持平滑
                  left: `${displaySize.ox + displaySize.w * dragPos.x}px`,
                  top: `${displaySize.oy + displaySize.h * dragPos.y}px`,
                  // 使用 center 作为 transform origin，与后端保持一致（text-anchor="middle", dominant-baseline="middle"）
                  transformOrigin: "center center",
                  transform: `rotate(${wmAngle}deg) translate(-50%,-50%)`,
                  cursor: "grab",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                }}
                onMouseDown={() => setDragging(true)}
              >
                {wmText}
              </div>
            )}
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

export default WatermarkModal;
