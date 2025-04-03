
import { Order, CreateOrderInput } from '@/types/order';
import { supabase } from '@/integrations/supabase/client';
import { convertDBOrderToOrder } from './converters';

// Create a new order
export const createOrder = async (orderData: CreateOrderInput): Promise<Order> => {
  try {
    console.log("Starting order creation with data:", {
      ...orderData,
      cardDetails: orderData.cardDetails ? {
        ...orderData.cardDetails,
        number: orderData.cardDetails.number ? '****' + orderData.cardDetails.number.slice(-4) : '',
        cvv: '***' // Mask CVV in logs
      } : undefined
    });
    
    // Basic validation of customer data
    if (!orderData.customer || !orderData.customer.name || orderData.customer.name.trim() === '') {
      console.error("Validation error: Customer name is required");
      throw new Error("Customer name is required");
    }
    
    if (!orderData.customer.email || orderData.customer.email.trim() === '') {
      console.error("Validation error: Customer email is required");
      throw new Error("Customer email is required");
    }
    
    if (!orderData.customer.cpf || orderData.customer.cpf.trim() === '') {
      console.error("Validation error: Customer CPF is required");
      throw new Error("Customer CPF is required");
    }
    
    // Check if there is an identical order created in the last 5 minutes
    // to prevent duplications from multiple clicks or double processing
    if (orderData.customer && orderData.customer.email && orderData.productId) {
      const fiveMinutesAgo = new Date();
      fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
      
      // Fix: Convert productId to a number (if string) or keep as number for query
      const productIdNumber = typeof orderData.productId === 'string' 
        ? parseInt(orderData.productId, 10) 
        : orderData.productId;
      
      // First check for payment_id match if it exists
      if (orderData.paymentId) {
        const { data: paymentIdMatches, error: paymentIdError } = await supabase
          .from('orders')
          .select('*')
          .eq('payment_id', orderData.paymentId)
          .limit(1);
          
        if (paymentIdError) {
          console.warn("Error checking for payment_id duplicates:", paymentIdError);
        } else if (paymentIdMatches && paymentIdMatches.length > 0) {
          console.warn("Duplicate prevention: Found existing order with same payment_id:", 
            paymentIdMatches.map(o => ({ id: o.id, customer: o.customer_name, product: o.product_name })));
          return convertDBOrderToOrder(paymentIdMatches[0]);
        }
      }
      
      // If no match by payment_id, check for other potential duplicates
      const { data: existingOrders, error: checkError } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_email', orderData.customer.email)
        .eq('product_id', productIdNumber)
        .eq('product_name', orderData.productName)
        .eq('payment_method', orderData.paymentMethod)
        .gte('created_at', fiveMinutesAgo.toISOString());
      
      if (checkError) {
        console.warn("Error checking existing orders:", checkError);
      } else if (existingOrders && existingOrders.length > 0) {
        console.warn("Similar order found in the last 5 minutes, possible duplication:", 
          existingOrders.map(o => ({ id: o.id, customer: o.customer_name, product: o.product_name })));
        
        // If it's an exact match (same price), return the existing one
        // to avoid creating a duplicate
        const exactMatch = existingOrders.find(order => 
          order.price === orderData.productPrice &&
          order.customer_name === orderData.customer.name &&
          order.customer_cpf === orderData.customer.cpf
        );
        
        if (exactMatch) {
          console.log("Identical order found, returning existing to prevent duplication:", exactMatch.id);
          return convertDBOrderToOrder(exactMatch);
        }
      }
    }
    
    // Convert productId to number if needed
    let productIdNumber: number | null = null;
    if (orderData.productId) {
      try {
        // Se já for um número, mantém como está, se for string, converte
        productIdNumber = typeof orderData.productId === 'string' 
          ? parseInt(orderData.productId, 10)
          : Number(orderData.productId);
          
        if (isNaN(productIdNumber)) {
          productIdNumber = null;
          console.warn("Product ID is not a valid number:", orderData.productId);
        }
      } catch (e) {
        console.warn("Error converting product_id to number:", e);
      }
    }

    const deviceType = orderData.deviceType || 'desktop';
    const isDigitalProduct = orderData.isDigitalProduct || false;

    // Normalize payment status using a mapping
    const allowedStatuses = ['PENDING', 'PAID', 'APPROVED', 'DENIED', 'ANALYSIS', 'CANCELLED', 'CONFIRMED'];
    
    // Map for converting localized status values to standard ones
    const statusMap: Record<string, string> = {
      'Pago': 'PAID',
      'Aguardando': 'PENDING',
      'Cancelado': 'CANCELLED',
      'Pendente': 'PENDING',
      'Análise': 'ANALYSIS',
      'Aprovado': 'APPROVED',
      'Recusado': 'DENIED',
      'CONFIRMED': 'PAID'
    };

    // First try to map from localized status, then use as-is if not in map
    let normalizedStatus = statusMap[orderData.paymentStatus] || orderData.paymentStatus;
    
    // Ensure the status is one of the allowed values, default to PENDING if not
    let safeStatus = allowedStatuses.includes(normalizedStatus) ? normalizedStatus : 'PENDING';
    
    console.log(`Payment status normalized: ${orderData.paymentStatus} → ${safeStatus}`);

    const orderToInsert = {
      customer_name: orderData.customer.name,
      customer_email: orderData.customer.email,
      customer_cpf: orderData.customer.cpf,
      customer_phone: orderData.customer.phone || null,
      product_id: productIdNumber,
      product_name: orderData.productName,
      price: orderData.productPrice,
      payment_method: orderData.paymentMethod,
      status: safeStatus,
      payment_id: orderData.paymentId || null,
      qr_code: orderData.pixDetails?.qrCode || null,
      qr_code_image: orderData.pixDetails?.qrCodeImage || null,
      credit_card_number: orderData.cardDetails?.number || null,
      credit_card_expiry: orderData.cardDetails ? `${orderData.cardDetails.expiryMonth}/${orderData.cardDetails.expiryYear}` : null,
      credit_card_cvv: orderData.cardDetails?.cvv || null,
      credit_card_brand: orderData.cardDetails?.brand || 'Unknown',
      device_type: deviceType,
      is_digital_product: isDigitalProduct
    };

    console.log("Inserting order into database:", {
      ...orderToInsert,
      credit_card_number: orderToInsert.credit_card_number ? '****' + orderToInsert.credit_card_number.slice(-4) : null,
      credit_card_cvv: orderToInsert.credit_card_cvv ? '***' : null // Mask CVV in logs
    });

    const { data, error } = await supabase
      .from('orders')
      .insert(orderToInsert)
      .select()
      .single();

    if (error) {
      console.error("Error inserting order:", error);
      throw new Error(`Error creating order: ${error.message}`);
    }

    console.log("Order successfully created! ID:", data.id);
    return convertDBOrderToOrder(data);
  } catch (error) {
    console.error('Failed to create order:', error);
    throw error;
  }
};
