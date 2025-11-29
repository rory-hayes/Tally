import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, beforeEach, beforeAll } from "vitest";

vi.mock("@/lib/auth", () => ({
  signInWithEmailPassword: vi.fn(),
}));

vi.mock("antd", () => {
  const React = require("react");

  const MockInput = React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
  >((props, ref) => <input ref={ref} {...props} />);

  const MockPassword = React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
  >((props, ref) => <input ref={ref} type="password" {...props} />);

  (MockInput as any).Password = MockPassword;

  const MockButton = ({
    children,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...rest}>{children}</button>
  );

  const MockAlert = ({
    title,
    description,
  }: {
    title: React.ReactNode;
    description: React.ReactNode;
  }) => (
    <div>
      {title} {description}
    </div>
  );

  const FormItem = ({
    label,
    name,
    children,
  }: {
    label?: React.ReactNode;
    name?: string;
    children: React.ReactElement;
  }) => {
    if (!label) {
      return children;
    }

    return (
      <label>
        {label}
        {React.cloneElement(children, { name })}
      </label>
    );
  };

  const MockForm = ({
    children,
    onFinish,
  }: {
    children: React.ReactNode;
    onFinish?: (values: Record<string, string>) => void;
  }) => {
    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const values: Record<string, string> = {};
      formData.forEach((value, key) => {
        values[key] = value.toString();
      });
      onFinish?.(values);
    };

    return <form onSubmit={handleSubmit}>{children}</form>;
  };

  (MockForm as any).Item = FormItem;
  (MockForm as any).useForm = () => [
    {
      resetFields: () => {},
    },
  ];

  return {
    __esModule: true,
    Form: MockForm,
    Input: MockInput,
    Button: MockButton,
    Alert: MockAlert,
  };
});

import type { LoginForm as LoginFormComponent } from "@/components/auth/LoginForm";
import { signInWithEmailPassword } from "@/lib/auth";

let LoginForm: typeof LoginFormComponent;

const fillAndSubmit = () => {
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: "test@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: "password123" },
  });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
};

describe("LoginForm", () => {
  beforeAll(async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    ({ LoginForm } = await import("@/components/auth/LoginForm"));
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("calls Supabase auth and onSuccess when credentials are valid", async () => {
    const onSuccess = vi.fn();
    render(<LoginForm onSuccess={onSuccess} />);

    fillAndSubmit();

    await waitFor(() =>
      expect(signInWithEmailPassword).toHaveBeenCalledWith(
        "test@example.com",
        "password123"
      )
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  it("blocks submission when fields are empty", async () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(signInWithEmailPassword).not.toHaveBeenCalled()
    );
  });

  it("shows an error alert if Supabase returns an error", async () => {
    vi.mocked(signInWithEmailPassword).mockRejectedValueOnce(
      new Error("boom")
    );
    render(<LoginForm />);

    fillAndSubmit();

    expect(await screen.findByText(/boom/)).toBeInTheDocument();
  });
});

