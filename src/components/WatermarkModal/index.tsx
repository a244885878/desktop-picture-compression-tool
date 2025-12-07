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
  xPercent?: number;
  yPercent?: number;
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

  // 表单值监听
  const wmText = Form.useWatch("watermarkText", form);
  const wmColor = Form.useWatch("color", form);
  const wmSize = Form.useWatch("fontSize", form);
  const wmAngle = Form.useWatch("angle", form) ?? 0;
  const wmXPercent = Form.useWatch("xPercent", form);
  const wmYPercent = Form.useWatch("yPercent", form);

  // DOM 引用
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // 图片尺寸信息
  const [imageInfo, setImageInfo] = useState<{
    naturalWidth: number;
    naturalHeight: number;
    displayWidth: number;
    displayHeight: number;
    offsetX: number;
    offsetY: number;
    scale: number;
  } | null>(null);

  // 预览图片源
  const previewSrc = useMemo(() => {
    if (!selectedFiles[0]) return undefined;
    return window.electronAPI?.getFileUrl
      ? window.electronAPI.getFileUrl(selectedFiles[0].path, false)
      : selectedFiles[0].path;
  }, [selectedFiles]);

  // 图片加载完成处理
  const handleImgLoad = React.useCallback(() => {
    const img = imgRef.current;
    const container = containerRef.current;

    if (!img || !container) return;

    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    if (!naturalWidth || !naturalHeight) {
      console.warn("无法获取图片尺寸", { naturalWidth, naturalHeight });
      return;
    }

    // 预览容器尺寸
    const containerWidth = 320;
    const containerHeight = 240;

    // 计算缩放比例（objectFit: contain）
    const scaleX = containerWidth / naturalWidth;
    const scaleY = containerHeight / naturalHeight;
    const scale = Math.min(scaleX, scaleY);

    // 计算显示尺寸
    const displayWidth = naturalWidth * scale;
    const displayHeight = naturalHeight * scale;

    // 计算居中偏移
    const offsetX = (containerWidth - displayWidth) / 2;
    const offsetY = (containerHeight - displayHeight) / 2;

    setImageInfo({
      naturalWidth,
      naturalHeight,
      displayWidth,
      displayHeight,
      offsetX,
      offsetY,
      scale,
    });
  }, []);

  // 图片加载错误处理
  const handleImgError = () => {
    console.error("图片加载失败", previewSrc);
    setImageInfo(null);
  };

  // 计算预览字体大小
  const previewFontSize = useMemo(() => {
    if (!imageInfo) return 16;

    // 与后端保持一致：fontDefault = Math.max(16, Math.round(Math.min(width, height) * 0.05))
    const minDimension = Math.min(
      imageInfo.naturalWidth,
      imageInfo.naturalHeight
    );
    const defaultFont = Math.max(16, Math.round(minDimension * 0.05));
    const baseFont = wmSize && wmSize > 0 ? Math.round(wmSize) : defaultFont;

    // 按预览缩放比例调整字体大小
    return Math.max(1, baseFont * imageInfo.scale);
  }, [wmSize, imageInfo]);

  // 计算预览位置（完全模拟后端计算）
  const previewPosition = useMemo(() => {
    if (!imageInfo) return { left: 0, top: 0 };

    // 1. 获取百分比值（0-100），默认90
    const xPercent =
      wmXPercent !== undefined && wmXPercent !== null
        ? Math.max(0, Math.min(100, wmXPercent))
        : 90;
    const yPercent =
      wmYPercent !== undefined && wmYPercent !== null
        ? Math.max(0, Math.min(100, wmYPercent))
        : 90;

    // 2. 转换为比例值（0-1），与后端完全一致
    // 后端：const xr = Math.max(0, Math.min(1, opts.xRatio));
    const xRatio = Math.max(0, Math.min(1, xPercent / 100));
    const yRatio = Math.max(0, Math.min(1, yPercent / 100));

    // 3. 计算原图坐标（与后端完全一致）
    // 后端：const x = Math.round(width * xr);
    const originalX = Math.round(imageInfo.naturalWidth * xRatio);
    const originalY = Math.round(imageInfo.naturalHeight * yRatio);

    // 4. 转换为预览坐标
    const previewX = imageInfo.offsetX + originalX * imageInfo.scale;
    const previewY = imageInfo.offsetY + originalY * imageInfo.scale;

    return {
      left: Math.round(previewX),
      top: Math.round(previewY),
    };
  }, [wmXPercent, wmYPercent, imageInfo]);

  // 提交处理
  const onFinish = async (values: FormType) => {
    if (!window.electronAPI) return;

    if (selectedFiles.length !== 1) {
      message.warning("请先选择文件");
      return;
    }

    if (!imageInfo) {
      message.warning("图片尚未加载完成，请稍候");
      return;
    }

    // 确定输出目录
    const outputDir = values.isUseCurrentDir
      ? currentDirectory
      : values.outputDir;

    // 将百分比转换为比例值（与后端完全一致）
    const xPercent =
      values.xPercent !== undefined && values.xPercent !== null
        ? Math.max(0, Math.min(100, values.xPercent))
        : 90;
    const yPercent =
      values.yPercent !== undefined && values.yPercent !== null
        ? Math.max(0, Math.min(100, values.yPercent))
        : 90;

    const xRatio = Math.max(0, Math.min(1, xPercent / 100));
    const yRatio = Math.max(0, Math.min(1, yPercent / 100));

    setConfirmLoading(true);
    try {
      const res = await window.electronAPI.addWatermarks(
        [selectedFiles[0]],
        values.watermarkText,
        outputDir,
        {
          fontSize: values.fontSize,
          color: values.color,
          angle: values.angle,
          xRatio,
          yRatio,
        }
      );

      if (res.success) {
        message.success("加水印成功");
        if (outputDir) {
          window.dispatchEvent(
            new CustomEvent<string>("refresh-directory", { detail: outputDir })
          );
        }
        onOk?.();
        onCancel?.();
      } else {
        const failed = res.results.filter((r) => !r.success).length;
        if (failed > 0) {
          message.error(`有 ${failed} 个文件加水印失败`);
        }
      }
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setConfirmLoading(false);
    }
  };

  // 每次打开弹窗时初始化
  useEffect(() => {
    if (open) {
      // 重置表单
      form.resetFields();

      // 设置初始值
      form.setFieldsValue({
        isUseCurrentDir: true,
        outputDir: currentDirectory,
        watermarkText: "",
        color: "rgba(255,255,255,0.75)",
        angle: 0,
        xPercent: 90,
        yPercent: 90,
      });

      // 重置图片信息（图片加载完成后会自动设置）
      setImageInfo(null);
    }
  }, [open, form, currentDirectory]);

  // 当预览源变化或弹窗打开时，检查图片是否已加载（处理缓存情况）
  useEffect(() => {
    if (open && previewSrc) {
      setImageInfo(null);

      // 使用 requestAnimationFrame 确保 DOM 已更新
      requestAnimationFrame(() => {
        const img = imgRef.current;
        if (
          img &&
          img.complete &&
          img.naturalWidth > 0 &&
          img.naturalHeight > 0
        ) {
          // 图片已经加载完成（可能是缓存），直接触发加载处理
          handleImgLoad();
        }
      });
    }
  }, [open, previewSrc, handleImgLoad]);

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

        <Form.Item<FormType>
          label="X位置（百分比）"
          name="xPercent"
          tooltip="X位置百分比，范围：0-100（0表示最左边，100表示最右边）"
          rules={[
            { required: true, message: "请输入X位置百分比" },
            {
              type: "number",
              min: 0,
              max: 100,
              message: "X位置百分比范围：0-100",
            },
          ]}
        >
          <InputNumber
            min={0}
            max={100}
            placeholder="0-100"
            style={{ width: "100%" }}
            precision={0}
            addonAfter="%"
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
          label="Y位置（百分比）"
          name="yPercent"
          tooltip="Y位置百分比，范围：0-100（0表示最上边，100表示最下边）"
          rules={[
            { required: true, message: "请输入Y位置百分比" },
            {
              type: "number",
              min: 0,
              max: 100,
              message: "Y位置百分比范围：0-100",
            },
          ]}
        >
          <InputNumber
            min={0}
            max={100}
            placeholder="0-100"
            style={{ width: "100%" }}
            precision={0}
            addonAfter="%"
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
          >
            {previewSrc && (
              <img
                key={previewSrc}
                src={previewSrc}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
                ref={imgRef}
                onLoad={handleImgLoad}
                onError={handleImgError}
                alt="预览"
              />
            )}
            {wmText && imageInfo && (
              <div
                style={{
                  position: "absolute",
                  left: `${previewPosition.left}px`,
                  top: `${previewPosition.top}px`,
                  color: wmColor ?? "rgba(255,255,255,0.75)",
                  fontSize: `${previewFontSize}px`,
                  fontFamily: "sans-serif",
                  textShadow:
                    "0 0 2px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.5)",
                  transformOrigin: "center center",
                  transform: `translate(-50%,-50%) rotate(${wmAngle}deg)`,
                  userSelect: "none",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                }}
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
