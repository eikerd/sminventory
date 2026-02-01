/**
 * Centralized error handler for API and application errors
 */

import { logger } from './logger';
import { toast } from 'sonner';

export interface AppError {
  code: string;
  message: string;
  details?: Record<string, any>;
  statusCode?: number;
}

export class ErrorHandler {
  static handle(error: unknown, context: string = 'Unknown'): AppError {
    logger.error(`Error in ${context}`, error);

    // Handle TRPC errors
    if (error && typeof error === 'object' && 'data' in error) {
      const trcpError = error as any;
      const message = trcpError.data?.message || trcpError.message || 'Request failed';
      const code = trcpError.data?.code || trcpError.code || 'INTERNAL_SERVER_ERROR';

      const appError: AppError = {
        code,
        message,
        statusCode: trcpError.data?.httpStatus,
        details: { originalError: trcpError },
      };

      // Show toast notification
      toast.error(`${context}: ${message}`);
      return appError;
    }

    // Handle standard Error objects
    if (error instanceof Error) {
      const appError: AppError = {
        code: 'ERROR',
        message: error.message,
        details: { stack: error.stack },
      };

      toast.error(`${context}: ${error.message}`);
      return appError;
    }

    // Handle unknown errors
    const message = String(error);
    const appError: AppError = {
      code: 'UNKNOWN_ERROR',
      message,
      details: { raw: error },
    };

    toast.error(`${context}: ${message}`);
    return appError;
  }

  static handleWorkflowError(error: unknown, workflowId: string): AppError {
    const appError = this.handle(error, `Workflow ${workflowId}`);
    logger.error(`Workflow operation failed`, error, { workflowId });
    return appError;
  }

  static handleScanError(error: unknown): AppError {
    const appError = this.handle(error, 'Workflow Scan');
    logger.error('Workflow scan failed', error);
    return appError;
  }

  static handleDownloadError(error: unknown, modelId: string): AppError {
    const appError = this.handle(error, `Download ${modelId}`);
    logger.error('Download failed', error, { modelId });
    return appError;
  }

  static handleTaskError(error: unknown, taskId: string): AppError {
    const appError = this.handle(error, `Task ${taskId}`);
    logger.error('Task operation failed', error, { taskId });
    return appError;
  }
}
