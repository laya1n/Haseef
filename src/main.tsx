import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "@/styles/globals.css";

// الصفحات
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Notifications from "@/pages/Notifications";
import Chat from "@/pages/Chat";
import Insurance from "@/pages/Insurance";
import Drugs from "@/pages/Drugs";

document.documentElement.lang = "ar";
document.documentElement.dir = "rtl";

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  { path: "/dashboard", element: <Dashboard /> },
  { path: "/insurance", element: <Insurance /> },
  { path: "/drugs", element: <Drugs /> },
  { path: "/notifications", element: <Notifications /> },
  { path: "/chat", element: <Chat /> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
