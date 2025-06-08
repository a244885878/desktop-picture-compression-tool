import { createHashRouter } from "react-router-dom";
import App from "@/App";
import Home from "@/views/home";
import About from "@/views/about";

const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "about",
        element: <About />,
      },
    ],
  },
]);

export default router;
