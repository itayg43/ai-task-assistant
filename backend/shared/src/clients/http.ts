import axios from "axios";

export const createHttpClient = (baseUrl: string, origin: string) => {
  return axios.create({
    baseURL: baseUrl,
    headers: {
      Origin: origin,
    },
  });
};
