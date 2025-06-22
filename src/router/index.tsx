import { createHashRouter } from "react-router-dom";
import App from "@/App";
import Home from "@/views/home";

const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <Home />,
      },
    ],
  },
]);

export default router;
