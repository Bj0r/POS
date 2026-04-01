// ============================================================
// FILE: src/App.tsx
//
// PURPOSE: Root of the Ionic app. Sets up routing and wraps
//          everything in AuthProvider so useAuth() works
//          everywhere.
//
// ROUTES:
//   /loading     → Loading / reCAPTCHA gate (public — cold-open entry)
//   /login       → Login page (public)
//   /register    → Register page (public)
//   /pending     → PendingApproval page (public)
//   /dashboard   → DashboardStaff (private — staff only)
//   /pos         → NewSale / POS (private)
//   /receipt/:id → Receipt detail (private)
//   /transactions→ Transaction history (private)
//   /profile     → Profile (private)
//   /            → redirect to /loading (passes reCAPTCHA gate first)
//
// LOADING / RECAPTCHA GATE:
//   Every cold open hits /loading first. Loading.tsx runs a
//   reCAPTCHA v3 invisible check against POST /api/recaptcha/verify.
//   On success it redirects to /login automatically after 3 s.
//   On localhost it bypasses the check and jumps straight to /login.
//
// PRIVATE ROUTE:
//   PrivateRoute checks useAuth().user before rendering.
//   While loading (boot token check) it shows a full-screen
//   spinner so there is no flash of unauthenticated content.
// ============================================================

import { IonApp, IonRouterOutlet, setupIonicReact, IonSpinner } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route } from 'react-router-dom';

import { AuthProvider } from './contexts/AuthContext';
import { useAuth }      from './contexts/useAuth';
import Loading          from './pages/Loading';
import Login            from './pages/Login';
import Register         from './pages/Register';
import PendingApproval  from './pages/PendingApproval';
import DashboardStaff   from './pages/DashboardStaff';
import NewSale          from './pages/NewSale';
import Receipt          from './pages/Receipt';
import Transactions     from './pages/Transactions';
import Profile          from './pages/Profile';

/* Core Ionic CSS — required */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

setupIonicReact();

// ── Private route guard ───────────────────────────────────────
function PrivateRoute({ component: Component, ...rest }: any) {
  const { user, loading } = useAuth();

  // Show spinner while the boot /me check runs
  if (loading) {
    return (
      <Route {...rest} render={() => (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100vh', backgroundColor: '#F7F3E8',
        }}>
          <IonSpinner name="crescent" style={{ color: '#2D6A1F', width: 48, height: 48 }} />
        </div>
      )} />
    );
  }

  return (
    <Route {...rest} render={() =>
      user ? <Component /> : <Redirect to="/login" />
    } />
  );
}

// ── App ───────────────────────────────────────────────────────
export default function App() {
  return (
    <IonApp>
      <AuthProvider>
        <IonReactRouter>
          <IonRouterOutlet>

            {/* Security gate — always the first stop on cold open */}
            <Route exact path="/loading"  component={Loading} />

            {/* Public pages */}
            <Route exact path="/login"    component={Login} />
            <Route exact path="/register" component={Register} />
            <Route exact path="/pending"  component={PendingApproval} />

            {/* Private pages (require token + approved account) */}
            <PrivateRoute exact path="/dashboard"    component={DashboardStaff} />
            <PrivateRoute exact path="/pos"          component={NewSale} />
            <PrivateRoute exact path="/transactions" component={Transactions} />
            <PrivateRoute exact path="/receipt/:id"  component={Receipt} />
            <PrivateRoute exact path="/profile"      component={Profile} />

            {/* Default redirect — goes through the reCAPTCHA gate */}
            <Route exact path="/" render={() => <Redirect to="/loading" />} />

          </IonRouterOutlet>
        </IonReactRouter>
      </AuthProvider>
    </IonApp>
  );
}