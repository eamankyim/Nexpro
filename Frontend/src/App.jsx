import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Vendors from './pages/Vendors';
import Jobs from './pages/Jobs';
import Invoices from './pages/Invoices';
import Payments from './pages/Payments';
import Expenses from './pages/Expenses';
import Pricing from './pages/Pricing';
import Users from './pages/Users';
import Profile from './pages/Profile';

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
        },
      }}
    >
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="customers" element={<Customers />} />
              <Route path="vendors" element={<Vendors />} />
              <Route path="jobs" element={<Jobs />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="payments" element={<Payments />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="pricing" element={<Pricing />} />
              <Route path="users" element={<Users />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ConfigProvider>
  );
}

export default App;


