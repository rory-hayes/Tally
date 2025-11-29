import { render, screen, act } from "@testing-library/react";
import Home from "@/app/page";

describe("Home page", () => {
  it("shows the Tally dashboard heading", async () => {
    await act(async () => {
      render(<Home />);
    });

    expect(
      screen.getByRole("heading", { name: /tally dashboard/i })
    ).toBeInTheDocument();
  });
});

