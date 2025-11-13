/* src/main.tsx */
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import "@/styles/globals.css";

/* Pages */
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Notifications from "@/pages/Notifications";
import Insurance from "@/pages/Insurance";
import Drugs from "@/pages/Drugs";

/* Routes */
import Protected from "@/routes/Protected";

/* إعداد اللغة والاتجاه للتطبيق كاملاً */
document.documentElement.lang = "ar";
document.documentElement.dir = "rtl";

/* تعريف الراوتر */
const router = createBrowserRouter([
  { path: "/", element: <Login /> },
  { path: "/register", element: <Register /> },
  { path: "/home", element: <Home /> },

  {
    path: "/dashboard",
    element: (
      <Protected>
        <Dashboard />
      </Protected>
    ),
  },
  {
    path: "/insurance",
    element: (
      <Protected>
        <Insurance />
      </Protected>
    ),
  },
  {
    path: "/drugs",
    element: (
      <Protected>
        <Drugs />
      </Protected>
    ),
  },
  {
    path: "/notifications",
    element: (
      <Protected>
        <Notifications />
      </Protected>
    ),
  },

  /* صفحة عدم العثور */
  {
    path: "*",
    element: (
      <div style={{ padding: 32, textAlign: "center" }}>
        الصفحة غير موجودة — <a href="/">العودة</a>
      </div>
    ),
  },
]);

/* إقلاع التطبيق */
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
