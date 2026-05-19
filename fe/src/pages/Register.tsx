import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../api/auth";

const Register: React.FC = () => {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [userid, setUserid] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("marketing");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const title = "Register | Development Gate System - MTM";
    if (document.title !== title) document.title = title;
  }, []);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!name || !userid || !email || !password) {
      setError("Semua field wajib diisi");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await register({
        name: name.trim(),
        userid: userid.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: role as "marketing" | "engineering" | "accounting" | "purchasing",
      });
      navigate("/login", { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Register gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form
        onSubmit={handleRegister}
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-md"
        noValidate
      >
        <h2 className="mb-6 text-left text-md font-semibold text-slate-700">
          Apps Register
        </h2>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-slate-600">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            disabled={loading}
            required
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-slate-600">User ID</label>
          <input
            type="text"
            value={userid}
            onChange={(e) => setUserid(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            disabled={loading}
            required
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-slate-600">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            disabled={loading}
            required
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-slate-600">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            disabled={loading}
          >
            <option value="marketing">Marketing</option>
            <option value="engineering">Engineering</option>
            <option value="accounting">Accounting</option>
            <option value="purchasing">Purchasing</option>
          </select>
        </div>

        <div className="mb-5">
          <label className="mb-1 block text-sm font-medium text-slate-600">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            disabled={loading}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-[#0A6ED1] py-2 text-sm font-medium text-white transition hover:bg-[#095FB5] focus:outline-none focus:ring-2 focus:ring-[#0A6ED1]/30 disabled:cursor-not-allowed disabled:bg-[#8BB7E8]"
        >
          {loading ? "Registering..." : "Register"}
        </button>

        <p className="mt-4 text-center text-sm text-slate-600">
          Sudah punya akun? <Link to="/login" className="text-blue-600 hover:underline">Login</Link>
        </p>
      </form>
    </div>
  );
};

export default Register;
