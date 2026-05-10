import { Response } from 'express';
import { ApiResponse, Pagination } from '../types';

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'تمت العملية بنجاح',
  statusCode = 200,
  pagination?: Pagination
): Response => {
  const response: ApiResponse<T> = { success: true, message, data };
  if (pagination) response.pagination = pagination;
  return res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  message: string,
  statusCode = 400,
  error?: string
): Response => {
  const response: ApiResponse = { success: false, message, error };
  return res.status(statusCode).json(response);
};

export const getPagination = (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  return { skip, take: limit };
};

export const buildPagination = (
  total: number,
  page: number,
  limit: number
): Pagination => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});
