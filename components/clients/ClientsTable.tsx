"use client";

import Link from "next/link";
import { Table, Button, Popconfirm } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ClientRow } from "@/lib/repositories/clients";

type ClientsTableProps = {
  loading: boolean;
  clients: ClientRow[];
  onEdit: (client: ClientRow) => void;
  onDelete: (client: ClientRow) => void;
  onRowClick?: (client: ClientRow) => void;
};

const columns = (
  onEdit: ClientsTableProps["onEdit"],
  onDelete: ClientsTableProps["onDelete"]
): ColumnsType<ClientRow> => [
  {
    title: "Name",
    dataIndex: "name",
    key: "name",
    render: (_value, record) => (
      <Link
        href={`/clients/${record.id}`}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        {record.name}
      </Link>
    ),
  },
  {
    title: "Country",
    dataIndex: "country",
    key: "country",
    render: (value: string | null) => value ?? "—",
  },
  {
    title: "Payroll System",
    dataIndex: "payroll_system",
    key: "payroll_system",
    render: (value: string | null) => value ?? "—",
  },
  {
    title: "Employees processed",
    dataIndex: "employees_processed",
    key: "employees_processed",
    render: (value: number | undefined) => value ?? 0,
  },
  {
    title: "Actions",
    key: "actions",
    align: "right" as const,
    render: (_value, record) => (
      <>
        <Button
          type="link"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(record);
          }}
        >
          Edit
        </Button>
        <Popconfirm
          title="Delete client"
          description={`Remove ${record.name}?`}
          onConfirm={() => onDelete(record)}
          okText="Delete"
          okButtonProps={{ danger: true }}
        >
          <Button
            type="link"
            danger
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            Delete
          </Button>
        </Popconfirm>
      </>
    ),
  },
];

export function ClientsTable({
  loading,
  clients,
  onEdit,
  onDelete,
  onRowClick,
}: ClientsTableProps) {
  return (
    <Table<ClientRow>
      rowKey="id"
      loading={loading}
      dataSource={clients}
      columns={columns(onEdit, onDelete)}
      pagination={false}
      onRow={(record) => ({
        onClick: () => onRowClick?.(record),
        style: onRowClick ? { cursor: "pointer" } : undefined,
      })}
    />
  );
}


