import { ItemType } from "../enum";

export interface BaseItem {
  name: string;
  type: ItemType;
  path: string; // 添加路径信息，用于导航
}

export interface FolderItem extends BaseItem {
  type: ItemType.FOLDER;
}

export interface ImageItem extends BaseItem {
  type: ItemType.IMAGE;
  previewUrl: string;
  mimeType: string;
  size: number; // 字节
}

export type Item = FolderItem | ImageItem;

export interface DirData {
  breadcrumb: string[]; // 面包屑路径数组
  items: Item[]; // 文件夹和图片文件数据
}
