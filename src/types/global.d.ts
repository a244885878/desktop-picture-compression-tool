declare namespace Type {
  type OtherKey = {
    [key: string]: any;
  };

  type ValueOf<T> = T[keyof T];
}

interface Window {
  electronAPI: {
    send: (channel: string, data: any) => void;
    receive: (channel: string, callback: (...args: any[]) => void) => void;
    once: (channel: string, callback: (...args: any[]) => void) => void;
    compressPictures: (data: {
      imageItems: any[];
      outputDirectory: string;
      quality?: number;
    }) => Promise<{
      success: boolean;
      results?: any[];
      error?: string;
    }>;
    deleteFiles: (items: any[]) => Promise<{
      success: boolean;
      results?: any[];
      error?: string;
    }>;
  };
}
