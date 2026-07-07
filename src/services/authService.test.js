import api from "./api";
import { authService } from "./authService";

jest.mock("./api", () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    put: jest.fn(),
  },
}));

describe("authService signup fallback", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it("stores a local user when the backend is unavailable", async () => {
    api.post.mockRejectedValueOnce({ message: "Network Error" });

    const result = await authService.signup({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "secret123",
      phone: "1234567890",
      gender: "female",
      community: "Test Community",
      preferences: {
        womenOnly: false,
        communityOnly: false,
        verifiedOnly: true,
      },
    });

    expect(result.user.email).toBe("jane@example.com");
    expect(localStorage.getItem("token")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("user")).email).toBe(
      "jane@example.com"
    );
  });
});
