import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../auth/useAuth";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { refreshMe } = useAuth();

  useEffect(() => {
    const title = "Login - Development Gate System - MTM";
    if (document.title !== title) document.title = title;
  }, []);

  const [userid, setUserid] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const cleanUserID = userid.trim();
    const cleanPassword = password.trim();

    if (!cleanUserID || !cleanPassword) {
      setError("User ID dan password wajib diisi");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await api.post(
        "/login",
        { userid: cleanUserID, password: cleanPassword },
        { withCredentials: true }
      );

      // pastikan backend benar-benar sukses
      if (res.status === 200) {
        await refreshMe();
        navigate("/main", { replace: true });
      } else {
        setError("Login gagal, silakan coba lagi");
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const backendMessage = err?.response?.data?.message;
      if (status === 0 || !status) {
        setError("Tidak bisa terhubung ke server. Cek koneksi jaringan dan URL.");
      } else if (backendMessage) {
        setError(String(backendMessage));
      } else {
        setError("Login gagal, silakan coba lagi");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-md"
        noValidate
      >
        {/* LOGO */}
        <div className="mb-6 flex justify-center">
          <img
            src="/MTMhd.png"
            alt="MTM Logo"
            className="h-10 w-auto object-contain"
          />
        </div>

        <h2 className="mb-6 text-left text-sm font-semibold text-slate-700">
          Login - Development Gate System - MTM
        </h2>
        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-600">
            User ID
          </label>
          <input
            type="text"
            value={userid}
            onChange={(e) => setUserid(e.target.value)}
            placeholder="Enter your user ID"
            autoComplete="username"
            className="
              w-full rounded-md border border-slate-300
              px-3 py-2 text-sm text-slate-700
              outline-none transition
              focus:border-blue-500 focus:ring-2 focus:ring-blue-100
            "
            disabled={loading}
            required
          />
        </div>

        {/* PASSWORD */}
        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium text-slate-600">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="
              w-full rounded-md border border-slate-300
              px-3 py-2 text-sm text-slate-700
              outline-none transition
              focus:border-blue-500 focus:ring-2 focus:ring-blue-100
            "
            disabled={loading}
            required
          />
        </div>

        {/* SUBMIT */}
        <button
          type="submit"
          disabled={loading}
          className="
            w-full rounded-md
            bg-[#0A6ED1]
            py-2 text-sm font-medium text-white
            transition
            hover:bg-[#095FB5]
            focus:outline-none
            focus:ring-2 focus:ring-[#0A6ED1]/30
            disabled:cursor-not-allowed
            disabled:bg-[#8BB7E8]
          "
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <p className="mt-4 text-center text-sm text-slate-600">
          Belum punya akun? <Link to="/register" className="text-blue-600 hover:underline">Register</Link>
        </p>
      </form>
    </div>
  );
};

export default Login;
