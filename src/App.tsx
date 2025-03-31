
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Contexts
import { AuthProvider } from './contexts/AuthContext';
import { ProductProvider } from './contexts/ProductContext';
import { OrderProvider } from './contexts/OrderContext';
import { AsaasProvider } from './contexts/AsaasContext';
import { PixelProvider } from './contexts/PixelContext';

// Pages
import Index from './pages/Index';
import Dashboard from './pages/Dashboard';
import Payments from './pages/Payments';
import Customers from './pages/Customers';
import Products from './pages/admin/Products';
import NotFound from './pages/NotFound';
import Login from './pages/admin/Login';
import AdminDashboard from './pages/admin/Dashboard';
import Orders from './pages/admin/Orders';
import PaymentSettings from './pages/admin/PaymentSettings';
import PixelSettings from './pages/admin/PixelSettings';
import AsaasSettings from './pages/admin/AsaasSettings';
import Checkout from './pages/Checkout';
import QuickCheckout from './pages/QuickCheckout';
import PaymentFailed from './pages/PaymentFailed';
import PixPaymentManual from './pages/PixPaymentManual';

// Component imports
import { Toaster } from './components/ui/toaster';

function App() {
  return (
    <Router>
      <AuthProvider>
        <ProductProvider>
          <OrderProvider>
            <AsaasProvider>
              <PixelProvider>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/payments" element={<Payments />} />
                  <Route path="/customers" element={<Customers />} />
                  
                  {/* Admin Routes */}
                  <Route path="/admin/login" element={<Login />} />
                  <Route path="/admin/dashboard" element={<AdminDashboard />} />
                  <Route path="/admin/products" element={<Products />} />
                  <Route path="/admin/orders" element={<Orders />} />
                  <Route path="/admin/settings/payment" element={<PaymentSettings />} />
                  <Route path="/admin/pixel-settings" element={<PixelSettings />} />
                  <Route path="/admin/asaas-settings" element={<AsaasSettings />} />
                  
                  {/* Checkout Routes */}
                  <Route path="/checkout/:productSlug" element={<Checkout />} />
                  <Route path="/quick-checkout/:productId" element={<QuickCheckout />} />
                  <Route path="/payment-failed" element={<PaymentFailed />} />
                  <Route path="/pix-payment-manual" element={<PixPaymentManual />} />
                  
                  {/* Catch all */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <Toaster />
              </PixelProvider>
            </AsaasProvider>
          </OrderProvider>
        </ProductProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
