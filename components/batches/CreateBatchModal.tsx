"use client";

import { useEffect, useState } from "react";
import { Form, Input, Modal } from "antd";

export type BatchFormValues = {
  periodLabel: string;
  notes?: string | null;
};

type CreateBatchModalProps = {
  open: boolean;
  onCancel: () => void;
  onSubmit: (values: BatchFormValues) => Promise<void>;
};

export function CreateBatchModal({
  open,
  onCancel,
  onSubmit,
}: CreateBatchModalProps) {
  const [form] = Form.useForm<BatchFormValues>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      form.resetFields();
    }
  }, [open, form]);

  const handleFinish = async (values: BatchFormValues) => {
    setSubmitting(true);
    try {
      await onSubmit({
        periodLabel: values.periodLabel.trim(),
        notes: values.notes?.trim() ? values.notes.trim() : null,
      });
      form.resetFields();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Upload batch"
      okText="Create batch"
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
    >
      <Form layout="vertical" form={form} onFinish={handleFinish}>
        <Form.Item
          label="Payroll period"
          name="periodLabel"
          rules={[{ required: true, message: "Enter the payroll period label" }]}
        >
          <Input placeholder="Eg. January 2025" />
        </Form.Item>
        <Form.Item label="Notes" name="notes">
          <Input.TextArea placeholder="Optional notes for this batch" rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}


