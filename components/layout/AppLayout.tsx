"use client";

import { Layout, Menu, Typography, Button, message, Space, Tag } from "antd";
import type { MenuProps } from "antd";
import {
  CloudUploadOutlined,
  DashboardOutlined,
  FileSearchOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import styles from "./AppLayout.module.css";
import { PropsWithChildren, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
    key: "data",
    icon: <CloudUploadOutlined />,
    label: "Data sources",
    children: [
      { key: "contracts", label: "Contracts & HR" },
      { key: "register", label: "Payroll register" },
      { key: "gl", label: "GL payroll postings" },
      { key: "payments", label: "Bank payments" },
      { key: "submissions", label: "Revenue/HMRC submissions" },
    ],
  },
  {
    key: "settings",
    icon: <SettingOutlined />,
    label: "Rules & Settings",
  },
];

export default function AppLayout({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  const selectedKey = useMemo(() => {
    if (pathname.startsWith("/clients")) return "clients";
    if (pathname.startsWith("/settings")) return "settings";
    if (pathname.startsWith("/data/contracts")) return "contracts";
    if (pathname.startsWith("/data/register")) return "register";
    if (pathname.startsWith("/data/gl")) return "gl";
    if (pathname.startsWith("/data/payments")) return "payments";
    if (pathname.startsWith("/data/submissions")) return "submissions";
    if (pathname.startsWith("/data")) return "data";
    return "dashboard";
  }, [pathname]);

  const openKeys = useMemo(() => {
    if (selectedKey === "contracts" || selectedKey === "register" || selectedKey === "gl" || selectedKey === "payments" || selectedKey === "submissions" || selectedKey === "data") {
      return ["data"];
    }
    return [];
  }, [selectedKey]);

  const handleMenuClick: MenuProps["onClick"] = ({ key }) => {
    if (key === selectedKey) {
      return;
    }
    switch (key) {
      case "clients":
        router.push("/clients");
        break;
      case "settings":
        router.push("/settings");
        break;
      case "contracts":
        router.push("/data/contracts");
        break;
      case "register":
        router.push("/data/register");
        break;
      case "gl":
        router.push("/data/gl");
        break;
      case "payments":
        router.push("/data/payments");
        break;
      case "submissions":
        router.push("/data/submissions");
        break;
      default:
        router.push("/");
    }
  };

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
          selectedKeys={[selectedKey]}
          openKeys={openKeys}
          onOpenChange={() => undefined}
          onClick={handleMenuClick}
          items={menuItems}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header className={styles.header} data-testid="app-header">
          <Space>
            <Typography.Title level={4} style={{ margin: 0 }}>
              Practice Overview
            </Typography.Title>
            {selectedKey && selectedKey !== "dashboard" ? (
              <Tag icon={<FileSearchOutlined />} color="blue">
                {selectedKey}
              </Tag>
            ) : null}
          </Space>
          <Button onClick={handleSignOut} loading={signingOut}>
            Sign out
          </Button>
        </Layout.Header>
        <Layout.Content className={styles.content}>{children}</Layout.Content>
      </Layout>
    </Layout>
  );
}
