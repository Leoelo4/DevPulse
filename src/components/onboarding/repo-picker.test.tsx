// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const saveAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/live", () => ({ saveSelectedRepositories: saveAction }));

import { RepoPicker, type PickerRepo } from "./repo-picker";

const repo = (name: string, extra: Partial<PickerRepo> = {}): PickerRepo => ({
  fullName: `octo/${name}`,
  description: `${name} description`,
  language: "TypeScript",
  isPrivate: false,
  isArchived: false,
  ...extra,
});

const repos = [
  repo("alpha"),
  repo("bravo", { isPrivate: true }),
  repo("charlie", { isArchived: true }),
];

function setup(props: Partial<Parameters<typeof RepoPicker>[0]> = {}) {
  saveAction.mockReset();
  return render(
    <RepoPicker repos={repos} initiallySelected={[]} max={2} truncated={false} {...props} />,
  );
}

const submitted = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="repos"]')].map(
    (i) => i.value,
  );

describe("RepoPicker", () => {
  it("lists repositories with their private/archived status", () => {
    setup();
    expect(screen.getByText("octo/alpha")).toBeInTheDocument();
    expect(screen.getByText("Private")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("starts with the saved selection checked and submits it", () => {
    const { container } = setup({ initiallySelected: ["octo/alpha"] });
    expect(screen.getByRole("checkbox", { name: /octo\/alpha/ })).toBeChecked();
    expect(submitted(container)).toEqual(["octo/alpha"]);
    expect(screen.getByRole("status")).toHaveTextContent("1 of 2 selected");
  });

  it("mirrors checkbox changes into the submitted form fields and the live count", async () => {
    const user = userEvent.setup();
    const { container } = setup();
    await user.click(screen.getByRole("checkbox", { name: /octo\/bravo/ }));
    expect(submitted(container)).toEqual(["octo/bravo"]);
    expect(screen.getByRole("status")).toHaveTextContent("1 of 2 selected");

    await user.click(screen.getByRole("checkbox", { name: /octo\/bravo/ }));
    expect(submitted(container)).toEqual([]);
  });

  it("enforces the cap by disabling further unchecked boxes, but keeps checked ones changeable", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("checkbox", { name: /octo\/alpha/ }));
    await user.click(screen.getByRole("checkbox", { name: /octo\/bravo/ }));

    expect(screen.getByRole("status")).toHaveTextContent("limit reached");
    expect(screen.getByRole("checkbox", { name: /octo\/charlie/ })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /octo\/alpha/ })).toBeEnabled();

    await user.click(screen.getByRole("checkbox", { name: /octo\/alpha/ }));
    expect(screen.getByRole("checkbox", { name: /octo\/charlie/ })).toBeEnabled();
  });

  it("filters the list without losing selections that are filtered out of view", async () => {
    const user = userEvent.setup();
    const { container } = setup();
    await user.click(screen.getByRole("checkbox", { name: /octo\/alpha/ }));
    await user.type(screen.getByRole("searchbox", { name: "Filter your repositories" }), "charlie");

    expect(screen.queryByRole("checkbox", { name: /octo\/alpha/ })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /octo\/charlie/ })).toBeInTheDocument();
    expect(submitted(container)).toEqual(["octo/alpha"]); // still part of the submission
  });

  it("explains an empty filter result", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText(/No repositories match/)).toBeInTheDocument();
  });

  it("cannot be submitted with nothing selected", () => {
    setup();
    expect(screen.getByRole("button", { name: /Save and open dashboard/ })).toBeDisabled();
  });

  it("keeps previously saved repositories that are no longer listed so the server can report them", () => {
    const { container } = setup({ initiallySelected: ["octo/alpha", "gone/removed"] });
    expect(submitted(container)).toEqual(["octo/alpha", "gone/removed"]);
  });

  it("tells the user when GitHub has more repositories than were loaded", () => {
    setup({ truncated: true });
    expect(screen.getByText(/more repositories than DevPulse loads/)).toBeInTheDocument();
  });

  it("shows the server's reason when saving fails, as an alert", async () => {
    const user = userEvent.setup();
    saveAction.mockReset();
    saveAction.mockResolvedValue({
      status: "error",
      message: "DevPulse can't read victim/secret.",
    });
    render(
      <RepoPicker repos={repos} initiallySelected={["octo/alpha"]} max={2} truncated={false} />,
    );

    await user.click(screen.getByRole("button", { name: /Save and open dashboard/ }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/can't read victim\/secret/)).toBeInTheDocument();
    await waitFor(() => expect(saveAction).toHaveBeenCalledOnce());
    const formData = saveAction.mock.calls[0]?.[1] as FormData;
    expect(formData.getAll("repos")).toEqual(["octo/alpha"]);
  });
});
