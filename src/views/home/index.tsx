import React, { useEffect, useState } from "react";
import styles from "./index.module.scss";
import { Breadcrumb } from "antd";
import { WindowsOutlined } from "@ant-design/icons";

// 获取驱动器列表
const getDriveLetters = (setDriveLetters: (driveLetters: string[]) => void) => {
  window.electronAPI.receive("system-paths", (msg) => {
    setDriveLetters(msg);
  });
};

// 盘符组件
const DriveLetter = () => {
  const [driveLetters, setDriveLetters] = useState<string[]>([]);

  useEffect(() => {
    getDriveLetters(setDriveLetters);
  }, []);

  return (
    <div className={styles.driveLettersList}>
      {driveLetters.map((driveLetter) => {
        return (
          <div className={styles.driveLetters} key={driveLetter}>
            <WindowsOutlined style={{ color: "#1677ff", fontSize: "16px" }} />
            <span style={{ marginLeft: "10px" }}>{driveLetter}</span>
          </div>
        );
      })}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <div className={styles.page}>
      <Breadcrumb
        separator=">"
        items={[
          {
            title: "Home",
          },
        ]}
      />
      <DriveLetter></DriveLetter>
    </div>
  );
};

export default App;
