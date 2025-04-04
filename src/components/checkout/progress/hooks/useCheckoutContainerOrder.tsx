
import React, { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useOrders } from '@/contexts/order';
import { ProductDetailsType } from '@/components/checkout/ProductDetails';
import { CustomerData } from '@/components/checkout/payment/shared/types';
import { validateCustomerData } from './utils/customerValidation';
import { createOrderService } from './services/orderCreationService';
import { UseCheckoutContainerOrderProps } from './types/checkoutOrderTypes';
import { Order, CardDetails, PixDetails } from '@/types/order';
import { logger } from '@/utils/logger';

// Global map to track payments being processed
const globalPaymentsInProgress = new Map<string, boolean>();

export const useCheckoutContainerOrder = ({
  formState,
  productDetails,
  handlePayment
}: UseCheckoutContainerOrderProps) => {
  const { toast } = useToast();
  const { addOrder } = useOrders();
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);
  const orderCreatedRef = useRef<string | null>(null);
  
  // Reset processing state after a timeout (safety mechanism)
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    if (isProcessing) {
      timeout = setTimeout(() => {
        setIsProcessing(false);
        processingRef.current = false;
        logger.warn("Resetting processing state after safety timeout");
      }, 30000); // 30 seconds
    }
    
    return () => {
      clearTimeout(timeout);
    };
  }, [isProcessing]);
  
  const createOrder = async (
    paymentId: string, 
    status: 'pending' | 'confirmed',
    cardDetails?: CardDetails,
    pixDetails?: PixDetails
  ): Promise<Order> => {
    try {
      logger.log(`Creating order for payment ID: ${paymentId}, status: ${status}`);
      
      // Double verification to prevent duplicate order creation
      if (isProcessing || processingRef.current) {
        logger.warn("Order creation already in progress, preventing duplication");
        throw new Error("Processing in progress. Please wait.");
      }
      
      // Check if we already created an order with this payment ID
      if (orderCreatedRef.current === paymentId) {
        logger.warn(`Order with payment ID ${paymentId} already created, preventing duplication`);
        throw new Error("Order already created with this payment ID");
      }
      
      // Check global tracking map
      if (globalPaymentsInProgress.has(paymentId)) {
        logger.warn(`Payment ID ${paymentId} is already being processed globally`);
        throw new Error("This payment is already being processed");
      }
      
      // Set both states for tracking
      setIsProcessing(true);
      processingRef.current = true;
      globalPaymentsInProgress.set(paymentId, true);
      
      // Prepare customer data
      const customerData: CustomerData = prepareCustomerData(formState);
      
      // Validate customer data
      const validationError = validateCustomerData(customerData);
      if (validationError) {
        logger.error("Validation error when creating order:", validationError);
        toast({
          title: "Validation error",
          description: validationError,
          variant: "destructive",
        });
        throw new Error(validationError);
      }
      
      const newOrder = await createOrderService({
        customerData,
        productDetails,
        status,
        paymentId,
        cardDetails,
        pixDetails,
        toast,
        addOrder
      });
      
      // Store the payment ID to prevent duplicates
      orderCreatedRef.current = paymentId;
      
      // Call the handlePayment function to complete the checkout process
      // We add a flag to indicate this order was just created
      const paymentResult = {
        orderId: newOrder.id,
        status: newOrder.paymentStatus === 'PAID' ? 'confirmed' : 'pending',
        paymentMethod: newOrder.paymentMethod,
        cardDetails: newOrder.cardDetails,
        pixDetails: newOrder.pixDetails,
        orderJustCreated: true // Flag to indicate this order was just created
      };
      
      // Call handlePayment with the order data
      handlePayment(paymentResult);
      
      return newOrder;
    } catch (error) {
      logger.error('Error creating order:', error);
      toast({
        title: "Order error",
        description: "It wasn't possible to complete the order. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      // Ensure processing states are reset
      setTimeout(() => {
        setIsProcessing(false);
        processingRef.current = false;
        // Remove from global map after a delay to ensure any parallel processes have completed
        if (paymentId) {
          globalPaymentsInProgress.delete(paymentId);
        }
      }, 2000);
    }
  };

  const prepareCustomerData = (formState: UseCheckoutContainerOrderProps['formState']): CustomerData => {
    return {
      name: formState.fullName,
      email: formState.email,
      cpf: formState.cpf,
      phone: formState.phone,
      address: formState.street ? {
        street: formState.street,
        number: formState.number,
        complement: formState.complement,
        neighborhood: formState.neighborhood,
        city: formState.city,
        state: formState.state,
        postalCode: formState.cep.replace(/\D/g, '')
      } : undefined
    };
  };

  const customerData = prepareCustomerData(formState);

  return {
    createOrder,
    customerData,
    isProcessing
  };
};

// Export function to clear global payment tracking (useful for testing)
export const clearGlobalPaymentTracking = () => {
  globalPaymentsInProgress.clear();
};
