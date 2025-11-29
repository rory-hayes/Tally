"use client";

import { useState } from "react";
import { Alert, Button, Form, Input } from "antd";
import { signInWithEmailPassword } from "@/lib/auth";

type LoginFormValues = {
  email: string;
  password: string;
};

type LoginFormProps = {
  onSuccess?: () => void;
};

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [form] = Form.useForm<LoginFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFinish = async (values: LoginFormValues) => {
    setSubmitting(true);
    setError(null);

    try {
      if (!values.email || !values.password) {
        setError("Please enter your email and password.");
        return;
      }

      await signInWithEmailPassword(values.email, values.password);
      form.resetFields();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      initialValues={{ email: "", password: "" }}
    >
      {error && (
        <Alert
          type="error"
          title="Login failed"
          description={error}
          showIcon
          style={{ marginBottom: "1rem" }}
        />
      )}
      <Form.Item
        label="Email"
        name="email"
        rules={[
          { required: true, message: "Please enter your email" },
          { type: "email", message: "Enter a valid email" },
        ]}
      >
        <Input placeholder="you@practice.com" autoComplete="email" />
      </Form.Item>
      <Form.Item
        label="Password"
        name="password"
        rules={[{ required: true, message: "Please enter your password" }]}
      >
        <Input.Password placeholder="••••••••" autoComplete="current-password" />
      </Form.Item>
      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          block
          loading={submitting}
          disabled={submitting}
        >
          Sign In
        </Button>
      </Form.Item>
    </Form>
  );
}

