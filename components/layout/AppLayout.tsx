"use client";

import { Layout, Menu, Typography } from "antd";
import type { MenuProps } from "antd";
import {
  DashboardOutlined,
  TeamOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import styles from "./AppLayout.module.css";
import { PropsWithChildren } from "react";

const menuItems: MenuProps["items"] = [
  {
    key: "dashboard",
    icon: <DashboardOutlined />,
    label: "Dashboard",
  },
  {
    key: "clients",
    icon: <TeamOutlined />,
    label: "Clients",
  },
  {
    key: "settings",
    icon: <SettingOutlined />,
    label: "Settings",
  },
];

export default function AppLayout({ children }: PropsWithChildren) {
  return (
    <Layout className={styles.layout}>
      <Layout.Sider
        className={styles.sider}
        width={240}
        data-testid="app-sider"
      >
        <div className={styles.logo}>Tally</div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={["dashboard"]}
          items={menuItems}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header className={styles.header} data-testid="app-header">
          <Typography.Title level={4} style={{ margin: 0 }}>
            Practice Overview
          </Typography.Title>
        </Layout.Header>
        <Layout.Content className={styles.content}>{children}</Layout.Content>
      </Layout>
    </Layout>
  );
}

