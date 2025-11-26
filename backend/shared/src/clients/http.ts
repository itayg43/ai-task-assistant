import axios, { AxiosError } from "axios";

export { AxiosError as HttpError } from "axios";

export const createHttpClient = (baseUrl: string, origin: string) => {
  return axios.create({
    baseURL: baseUrl,
    headers: {
      Origin: origin,
    },
  });
};

export const isHttpError = (error: unknown): error is AxiosError => {
  return error instanceof AxiosError;
};
