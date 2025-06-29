import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import router from "./router";
import "./index.scss";
import { ConfigProvider, App } from "antd";
import zhCN from "antd/locale/zh_CN";

createRoot(document.getElementById("root")!).render(
  <ConfigProvider locale={zhCN}>
    <App>
      <RouterProvider router={router} />
    </App>
  </ConfigProvider>
);
