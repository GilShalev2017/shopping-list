import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ShoppingListPage } from '@/pages/ShoppingListPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { OrderConfirmationPage } from '@/pages/OrderConfirmationPage';
import { useAppearance } from '@/features/ui/useAppearance';

export const App = () => {
  // Reflects the Redux theme/locale onto <html> (data-theme, dir, lang).
  useAppearance();

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<ShoppingListPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/orders/:orderId" element={<OrderConfirmationPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
};

export default App;
