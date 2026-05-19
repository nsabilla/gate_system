import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../api/axios";

const RfqDetail = () => {
  const { id } = useParams();

  // ===== STATE =====
  const [rfq, setRfq] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  // tidak terpakai 
  // const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    activity_name: "",
    pic: "",
    start_date: "",
    due_date: "",
  });

  // ===== FETCH DETAIL =====
  const fetchDetail = async () => {
    try {
      const res = await api.get(`/rfqs/${id}`, {
        withCredentials: true,
      });
      setRfq(res.data.rfq);
      setProducts(res.data.products || []);
      // tidak terpakai
      // setActivities(res.data.activities || []);

    } catch (err) {
      console.error("RFQ DETAIL ERROR", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  // ===== SUBMIT ACTIVITY =====
  const handleSubmit = async () => {
    try {
      await api.post(
        `/rfqs/${id}/activities`,
        form,
        { withCredentials: true }
      );

      setForm({
        activity_name: "",
        pic: "",
        start_date: "",
        due_date: "",
      });

      setShowForm(false);
      fetchDetail();
    } catch (err) {
      console.error("CREATE ACTIVITY ERROR", err);
    }
  };

  if (loading) return <div>Loading...</div>;

  // ===== JSX =====
  return (
    <><div className="max-w-5xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="rounded-xl border p-4 bg-white">
          <h1 className="text-xl font-semibold">RFQ Detail</h1>
          <p className="text-sm text-gray-500">
            RFQ No: {rfq?.rfq_no}
          </p>
        </div>

        {/* PRODUCTS */}
        <div className="rounded-xl border p-4 bg-white">
          <h2 className="font-semibold mb-3">Products</h2>
          {products.map((p, i) => (
            <div key={i} className="text-sm">
              • {p.product_type} - {p.part_name}
            </div>
          ))}
        </div>

        {/* ACTIVITY TIMELINE */}
        <div className="rounded-xl border p-4 bg-white">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Activity Timeline</h2>

            <button
              className="px-3 py-1 bg-blue-600 text-white rounded"
              onClick={() => setShowForm(!showForm)}
            >
              + Add Activity
            </button>
          </div>

          {showForm && (
            <div className="mb-4 border rounded p-4 space-y-3">
              <input
                className="w-full border px-3 py-2 rounded"
                placeholder="Activity Name"
                value={form.activity_name}
                onChange={(e) => setForm({ ...form, activity_name: e.target.value })} />

              <select
                className="w-full border px-3 py-2 rounded"
                value={form.pic}
                onChange={(e) => setForm({ ...form, pic: e.target.value })}
              >
                <option value="">Select PIC</option>
                <option value="MKT">Marketing</option>
                <option value="PdE">Engineering</option>
                <option value="ACC">Accounting</option>
              </select>

              <div className="flex gap-3">
                <input
                  type="date"
                  className="border px-3 py-2 rounded w-full"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })} />

                <input
                  type="date"
                  className="border px-3 py-2 rounded w-full"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>

              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                Save Activity
              </button>
            </div>
          )}
        </div>
      </div></>
  );
};
export default RfqDetail;
