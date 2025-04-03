
import { useCallback, useRef } from 'react';
import { CardDetails, PixDetails, Order } from '@/types/order';
import { logger } from '@/utils/logger';

// Global set to track payment IDs that are being or have been processed
const processedPaymentIds = new Set<string>();

export const usePaymentWrapper = () => {
  // Usar ref para rastrear o estado da criação do pedido e evitar duplicações
  const isProcessingRef = useRef(false);
  const localProcessedPaymentIds = useRef(new Set<string>());

  /**
   * Handles order creation with proper logging for debugging and duplicate prevention
   */
  const handleOrderCreation = useCallback(
    async (
      paymentId: string,
      status: 'pending' | 'confirmed',
      createOrder: (
        paymentId: string,
        status: 'pending' | 'confirmed',
        cardDetails?: CardDetails,
        pixDetails?: PixDetails
      ) => Promise<Order>,
      cardDetails?: CardDetails,
      pixDetails?: PixDetails
    ): Promise<Order> => {
      // Generate a consistent ID if none provided
      const safePaymentId = paymentId || `payment_${Date.now()}`;
      
      logger.log(`PaymentWrapper: Processing payment ${safePaymentId} with status ${status}`);
      
      // Check for duplicates in both global and local sets
      if (processedPaymentIds.has(safePaymentId) || localProcessedPaymentIds.current.has(safePaymentId)) {
        logger.warn(`PaymentWrapper: Payment ID ${safePaymentId} has already been processed, preventing duplicate order`);
        throw new Error(`A payment with ID ${safePaymentId} is already being processed`);
      }
      
      // Check if we're already processing a payment
      if (isProcessingRef.current) {
        logger.warn('PaymentWrapper: Already processing a payment, preventing concurrent processing');
        throw new Error('Payment processing in progress, please wait');
      }

      try {
        // Mark as processing
        isProcessingRef.current = true;
        processedPaymentIds.add(safePaymentId);
        localProcessedPaymentIds.current.add(safePaymentId);
        
        // Normalize status value
        const normalizedStatus = status.toLowerCase() === 'confirmed' ? 'confirmed' : 'pending';
        
        logger.log(`PaymentWrapper: Creating order for payment ${safePaymentId} with normalized status ${normalizedStatus}`);
        const order = await createOrder(safePaymentId, normalizedStatus, cardDetails, pixDetails);
        logger.log(`PaymentWrapper: Order created successfully with ID ${order.id}`);
        
        return order;
      } catch (error) {
        logger.error('PaymentWrapper: Error creating order:', error);
        throw error;
      } finally {
        // Importante: garantir que a flag seja resetada mesmo em caso de erro
        setTimeout(() => {
          isProcessingRef.current = false;
          // Não removemos da lista de processados, pois queremos manter
          // o registro de que esse pagamento já foi processado
        }, 1000);
      }
    },
    []
  );

  // Função para limpar o histórico de pagamentos processados (útil para testes)
  const clearProcessedPayments = useCallback(() => {
    processedPaymentIds.clear();
    localProcessedPaymentIds.current.clear();
  }, []);

  return { handleOrderCreation, clearProcessedPayments };
};

// Função para limpar o histórico global de pagamentos processados (útil para testes ou resets)
export const clearGlobalProcessedPayments = () => {
  processedPaymentIds.clear();
};
