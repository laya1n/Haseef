/* src/main.tsx */
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import "@/styles/globals.css";

import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Notifications from "@/pages/Notifications";
import Chat from "@/pages/Chat";
import Insurance from "@/pages/Insurance";
import Drugs from "@/pages/Drugs";
import Protected from "@/routes/Protected";

document.documentElement.lang = "ar";
document.documentElement.dir = "rtl";

const router = createBrowserRouter([
  { path: "/home", element: <Home /> },
  { path: "/", element: <Login /> },
  { path: "/register", element: <Register /> },
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
  {
    path: "/chat",
    element: (
      <Protected>
        <Chat />
      </Protected>
    ),
  },
  {
    path: "*",
    element: (
      <div style={{ padding: 32, textAlign: "center" }}>
        الصفحة غير موجودة — <a href="/">العودة</a>
      </div>
    ),
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
