"use client";

import { Layout, Menu, Typography, Button, message } from "antd";
import type { MenuProps } from "antd";
import {
  DashboardOutlined,
  TeamOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import styles from "./AppLayout.module.css";
import { PropsWithChildren, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth";

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
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/login");
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "Unable to sign out. Try again."
      );
    } finally {
      setSigningOut(false);
    }
  };

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
          <Button onClick={handleSignOut} loading={signingOut}>
            Sign out
          </Button>
        </Layout.Header>
        <Layout.Content className={styles.content}>{children}</Layout.Content>
      </Layout>
    </Layout>
  );
}

