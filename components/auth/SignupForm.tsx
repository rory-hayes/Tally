"use client";

import { useState } from "react";
import { Alert, Button, Form, Input } from "antd";
import { signUpWithEmailPassword } from "@/lib/auth";

type SignupFormValues = {
  email: string;
  password: string;
  confirm: string;
};

type SignupFormProps = {
  onSuccess?: () => void;
};

export function SignupForm({ onSuccess }: SignupFormProps) {
  const [form] = Form.useForm<SignupFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFinish = async (values: SignupFormValues) => {
    setSubmitting(true);
    setError(null);

    try {
      await signUpWithEmailPassword(values.email, values.password);
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
      initialValues={{ email: "", password: "", confirm: "" }}
    >
      {error && (
        <Alert
          type="error"
          title="Signup failed"
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
        rules={[
          { required: true, message: "Please create a password" },
          { min: 8, message: "Use at least 8 characters" },
        ]}
      >
        <Input.Password placeholder="••••••••" autoComplete="new-password" />
      </Form.Item>
      <Form.Item
        label="Confirm password"
        name="confirm"
        dependencies={["password"]}
        rules={[
          { required: true, message: "Please confirm your password" },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue("password") === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error("Passwords do not match"));
            },
          }),
        ]}
      >
        <Input.Password placeholder="••••••••" autoComplete="new-password" />
      </Form.Item>
      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          block
          loading={submitting}
          disabled={submitting}
        >
          Create Account
        </Button>
      </Form.Item>
    </Form>
  );
}

