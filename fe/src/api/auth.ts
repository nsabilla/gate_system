import api from "./axios";

export type RegisterPayload = {
  name: string;
  userid: string;
  email: string;
  password: string;
  role?: "marketing" | "engineering" | "accounting" | "purchasing";
};

export const register = async (payload: RegisterPayload) => {
  return api.post("/register", payload, { withCredentials: true });
};
