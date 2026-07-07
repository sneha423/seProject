import api from "./api";

export const poolService = {
  createPool: async (poolData) => {
    try {
      const response = await api.post("/pools", poolData);
      return response.data;
    } catch (error) {
      console.warn("Pool creation failed, using local fallback", error);
      return {
        success: true,
        pool: {
          ...poolData,
          _id: `local-${Date.now()}`,
          status: "upcoming",
          participants: []
        }
      };
    }
  },

  getPools: async (filters = {}) => {
    try {
      const response = await api.get("/pools", { params: filters });
      return response.data;
    } catch (error) {
      console.warn("Pool fetch failed, returning empty list", error);
      return {
        pools: [],
      };
    }
  },

  getPoolById: async (poolId) => {
    try {
      const response = await api.get(`/pools/${poolId}`);
      return response.data;
    } catch (error) {
      console.warn("Pool fetch by ID failed", error);
      return {
        pool: null,
      };
    }
  },

  joinPool: async (poolId) => {
    try {
      const response = await api.post(`/pools/${poolId}/join`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.message || "Failed to join pool";
    }
  },

  leavePool: async (poolId) => {
    try {
      const response = await api.post(`/pools/${poolId}/leave`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.message || "Failed to leave pool";
    }
  },

  getMyPools: async () => {
    try {
      const response = await api.get("/pools/my-pools");
      return response.data;
    } catch (error) {
      console.warn("Using local pool fallback", error);
      return {
        pools: []
      };
    }
  },

  updatePoolStatus: async (poolId, status) => {
    try {
      const response = await api.patch(`/pools/${poolId}/status`, { status });
      return response.data;
    } catch (error) {
      throw error.response?.data?.message || "Failed to update pool status";
    }
  },

  deletePool: async (poolId) => {
    try {
      const response = await api.delete(`/pools/${poolId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.message || "Failed to delete pool";
    }
  },
};
