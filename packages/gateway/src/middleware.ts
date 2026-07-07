/**
 * x402 Payment Middleware for Express
 * 
 * Implements the x402 v2 flow for Express/Node.js:
 * 1. Request hits protected endpoint
 * 2. If no valid X-Payment header → 402 Payment Required
 * 3. Client re-sends with payment proof → verify & serve
 */

import { Request, Response, NextFunction } from 'express';
import {
  CasperX402Facilitator,
  PaymentRequirement,
  PaymentRequiredResponse,
} from '../../core/src/index';

/** Configuration for the x402 middleware */
export interface X402MiddlewareConfig {
  /** Casper x402 Facilitator for verifying payments */
  facilitator: CasperX402Facilitator;
  /** Payment requirements per route */
  routes: Record<string, PaymentRequirement>;
  /** Optional: free routes (no payment needed) */
  freeRoutes?: string[];
}

/**
 * Express middleware that enforces x402 payments.
 * Returns 402 Payment Required with Casper payment details if no valid payment.
 */
export function x402Middleware(config: X402MiddlewareConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if route is free
    const path = req.path;
    if (config.freeRoutes?.includes(path)) {
      return next();
    }

    // Check if x402 is set up for this route
    const requirement = config.routes[path];
    if (!requirement) {
      // No payment config → allow (for demo flexibility)
      return next();
    }

    // Check for X-Payment header
    const paymentHeader = req.headers['x-payment'] as string | undefined;

    if (!paymentHeader) {
      // No payment → return 402
      const body: PaymentRequiredResponse = {
        x402Version: '2.0',
        accepts: [requirement],
        description: `Payment required for ${path}. Send CSPR via x402.`,
      };
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Expose-Headers', 'X-Payment-Response');
      return res.status(402).json(body);
    }

    // Verify payment
    const result = config.facilitator.verify(paymentHeader, requirement);

    if (!result.valid) {
      return res.status(402).json({
        x402Version: '2.0',
        accepts: [requirement],
        description: `Payment verification failed: ${result.reason}`,
      });
    }

    // Attach payment info to request for downstream handlers
    (req as any).x402Payment = result.payload;
    next();
  };
}

/**
 * Wraps the response handler to include x402 settlement info.
 * After serving the request, settles the payment.
 */
export function withSettlement(config: X402MiddlewareConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const path = req.path;
    const requirement = config.routes[path];
    const payment = (req as any).x402Payment;

    if (!payment || !requirement) {
      return next();
    }

    // Override res.json to capture and augment response
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      // Attempt settlement (non-blocking for demo)
      config.facilitator.settle(payment, requirement).then((settlement: any) => {
        if (settlement.success) {
          body.x402Settlement = {
            transactionHash: settlement.transactionHash,
            status: 'settled',
          };
        }
        return originalJson(body);
      }).catch(() => {
        return originalJson(body);
      });
      return res;
    };

    next();
  };
}