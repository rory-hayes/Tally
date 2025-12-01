"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Space, Typography, Button, message, Spin, Empty, Alert } from "antd";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useOrganisation } from "@/context/OrganisationContext";
import {
  ClientRow,
  createClient,
  deleteClient,
  getClientsForOrg,
  updateClient,
} from "@/lib/repositories/clients";
import { ClientFormModal } from "@/components/clients/ClientFormModal";
import { ClientsTable } from "@/components/clients/ClientsTable";

export default function ClientsPage() {
  return (
    <RequireAuth>
      <AppLayout>
        <ClientsManager />
      </AppLayout>
    </RequireAuth>
  );
}

export function ClientsManager() {
  const { organisationId } = useOrganisation();
  const router = useRouter();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClientsForOrg(organisationId);
      setClients(data);
    } catch (err) {
      const messageText =
        err instanceof Error ? err.message : "Unable to load clients";
      setError(messageText);
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, [organisationId]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleCreateClick = () => {
    setEditingClient(null);
    setModalOpen(true);
  };

  const handleEdit = (client: ClientRow) => {
    setEditingClient(client);
    setModalOpen(true);
  };

  const handleDelete = async (client: ClientRow) => {
    try {
      await deleteClient(organisationId, client.id);
      message.success(`Deleted ${client.name}`);
      fetchClients();
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "Failed to delete client"
      );
    }
  };

  const handleSubmit = async (values: {
    name: string;
    country?: string | null;
    payroll_system?: string | null;
  }) => {
    try {
      if (editingClient) {
        await updateClient(organisationId, editingClient.id, values);
        message.success("Client updated");
      } else {
        await createClient(organisationId, values);
        message.success("Client created");
      }
      setModalOpen(false);
      setEditingClient(null);
      fetchClients();
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "Failed to save client"
      );
      throw err;
    }
  };

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <Space
        orientation="horizontal"
        align="center"
        style={{ justifyContent: "space-between", width: "100%" }}
      >
        <div>
          <Typography.Title level={3} style={{ marginBottom: 0 }}>
            Clients
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Manage payroll clients across your organisation.
          </Typography.Paragraph>
        </div>
        <Button type="primary" onClick={handleCreateClick}>
          Add client
        </Button>
      </Space>

      <Card>
        {error ? (
          <div style={{ marginBottom: 16 }}>
            <Alert
              type="error"
              message="Unable to load clients"
              description={error}
              showIcon
            />
          </div>
        ) : null}

        {loading && clients.length === 0 ? (
          <div
            style={{
              minHeight: 160,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Spin aria-label="Loading clients" />
          </div>
        ) : clients.length === 0 ? (
          <Empty description="No clients yet. Click “Add client” to create your first one." />
        ) : (
          <ClientsTable
            loading={loading}
            clients={clients}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onRowClick={(client) => router.push(`/clients/${client.id}`)}
          />
        )}
      </Card>

      <ClientFormModal
        open={modalOpen}
        title={editingClient ? "Edit client" : "Add client"}
        initialValues={editingClient ?? undefined}
        onCancel={() => {
          setModalOpen(false);
          setEditingClient(null);
        }}
        onSubmit={handleSubmit}
      />
    </Space>
  );
}


