import api from "./api";

const LOCAL_USERS_KEY = "ridecircle-local-users";
const ENABLE_LOCAL_AUTH_FALLBACK =
  process.env.REACT_APP_ENABLE_LOCAL_AUTH_FALLBACK === "true" &&
  process.env.NODE_ENV !== "production";

const getLocalUsers = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");
  } catch (error) {
    return [];
  }
};

const saveLocalUsers = (users) => {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
};

const findLocalUser = (email) => {
  const normalizedEmail = email.trim().toLowerCase();
  return getLocalUsers().find((user) => user.email.toLowerCase() === normalizedEmail);
};

const addLocalUser = (user, password) => {
  const normalizedEmail = user.email.trim().toLowerCase();
  const users = getLocalUsers().filter(
    (existing) => existing.email.toLowerCase() !== normalizedEmail
  );
  users.push({
    ...user,
    email: normalizedEmail,
    password,
  });
  saveLocalUsers(users);
};

const setAuthSession = (payload) => {
  localStorage.setItem("token", payload.token);
  localStorage.setItem("user", JSON.stringify(payload.user));
};

export const authService = {
  signup: async (userData) => {
    try {
      const response = await api.post("/auth/signup", userData);
      if (response.data.token) {
        setAuthSession(response.data);
        if (userData.password) {
          addLocalUser(response.data.user, userData.password);
        }
      }
      return response.data;
    } catch (error) {
      console.error("authService.signup error:", error.response || error);

      const serverMsg = error.response?.data?.message;
      const serverData = error.response?.data;

      if (!ENABLE_LOCAL_AUTH_FALLBACK) {
        throw serverMsg || serverData ||
          "Unable to contact authentication server. Please try again later.";
      }

      const existingLocalUser = findLocalUser(userData.email);
      if (existingLocalUser) {
        throw new Error("An account already exists for this email.");
      }

      const fallbackUser = {
        id: Date.now(),
        name: userData.name,
        email: userData.email.trim().toLowerCase(),
        phone: userData.phone,
        gender: userData.gender,
        community: userData.community,
        preferences: userData.preferences,
      };

      const fallbackPayload = {
        token: `local-dev-token-${Date.now()}`,
        user: fallbackUser,
      };

      setAuthSession(fallbackPayload);
      addLocalUser(fallbackUser, userData.password);

      if (serverMsg || serverData) {
        throw serverMsg || serverData;
      }

      return fallbackPayload;
    }
  },

  login: async (credentials) => {
    try {
      const response = await api.post("/auth/login", credentials);
      if (response.data.token) {
        setAuthSession(response.data);
        if (credentials.password) {
          addLocalUser(response.data.user, credentials.password);
        }
      }
      return response.data;
    } catch (error) {
      console.error("authService.login error:", error.response || error);

      const serverMsg = error.response?.data?.message;
      const serverData = error.response?.data;

      const localUser = findLocalUser(credentials.email);
      if (!localUser || localUser.password !== credentials.password) {
        if (!ENABLE_LOCAL_AUTH_FALLBACK) {
          throw serverMsg || serverData ||
            "Unable to authenticate. Please check your backend configuration.";
        }

        if (localUser && localUser.password !== credentials.password) {
          throw new Error("Invalid email or password.");
        }

        throw serverMsg || serverData || new Error("Invalid email or password.");
      }

      const fallbackPayload = {
        token: `local-dev-token-${Date.now()}`,
        user: {
          ...localUser,
        },
      };

      setAuthSession(fallbackPayload);
      return fallbackPayload;
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },

  getCurrentUser: () => {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  },

  updateProfile: async (userId, userData) => {
    try {
      const response = await api.put(`/auth/profile/${userId}`, userData);
      if (response.data.user) {
        localStorage.setItem("user", JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (error) {
      console.error(
        "authService.updateProfile error:",
        error.response || error
      );
      if (!error.response) {
        const localUser = {
          ...JSON.parse(localStorage.getItem("user") || "{}"),
          ...userData,
        };
        localStorage.setItem("user", JSON.stringify(localUser));
        return { user: localUser };
      }
      const serverMsg = error.response?.data?.message;
      const serverData = error.response?.data;
      throw serverMsg || serverData || error.message || "Profile update failed";
    }
  },
};
