import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, beforeEach } from "vitest";

vi.mock("@/lib/repositories/profiles", () => ({
  createOrganisationWithProfile: vi.fn(),
}));

const mockRouterReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
  }),
}));

vi.mock("antd", () => {
  const React = require("react");

  const Input = ({
    placeholder,
    onChange,
  }: {
    placeholder?: string;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  }) => (
    <input
      name="organisationName"
      placeholder={placeholder}
      onChange={onChange}
      aria-label="Organisation name"
    />
  );

  const Button = ({
    children,
    htmlType,
    block,
    loading,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    htmlType?: "button" | "submit";
    block?: boolean;
    loading?: boolean;
  }) => (
    <button type={htmlType} data-block={block} data-loading={loading} {...rest}>
      {children}
    </button>
  );

  const Alert = ({
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
    children,
  }: {
    label?: React.ReactNode;
    children: React.ReactElement;
  }) =>
    label ? (
      <label>
        {label}
        {children}
      </label>
    ) : (
      children
    );

  const Form = ({
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

  (Form as any).Item = FormItem;
  (Form as any).useForm = () => [
    {
      resetFields: () => {},
    },
  ];

  return {
    __esModule: true,
    Form,
    Input,
    Button,
    Alert,
  };
});

import { CreateOrganisationForm } from "@/components/auth/CreateOrganisationForm";
import { createOrganisationWithProfile } from "@/lib/repositories/profiles";

const fillAndSubmit = () => {
  fireEvent.change(screen.getByLabelText(/organisation name/i), {
    target: { value: "Apex Accounting" },
  });
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));
};

describe("CreateOrganisationForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRouterReplace.mockReset();
  });

  it("creates organisation and navigates home", async () => {
    render(<CreateOrganisationForm onSuccess={() => mockRouterReplace("/")} />);

    fillAndSubmit();

    await waitFor(() =>
      expect(createOrganisationWithProfile).toHaveBeenCalledWith(
        "Apex Accounting"
      )
    );
    expect(mockRouterReplace).toHaveBeenCalledWith("/");
  });

  it("shows errors from repository failures", async () => {
    vi.mocked(createOrganisationWithProfile).mockRejectedValueOnce(
      new Error("boom")
    );
    render(<CreateOrganisationForm />);

    fillAndSubmit();

    expect(await screen.findByText(/boom/)).toBeInTheDocument();
  });
});
