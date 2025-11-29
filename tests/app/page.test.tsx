import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home page", () => {
  it("shows the Tally dashboard heading", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /tally dashboard/i })
    ).toBeInTheDocument();
  });
});

