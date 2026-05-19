import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Popconfirm,
  Space,
  notification,
  Tag
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAuth } from '../auth/useAuth';
import {
  getStandardCostMaster,
  createStandardCostMaster,
  updateStandardCostMaster,
  deleteStandardCostMaster,
} from '../api/standardCost';
import { type StandardCostMasterRow, type StandardCostPayload } from '../api/standardCost';

const wcOptions = ['CUTTING - SHEARING MORI', 'CUTTING - SHEARING MANYO', 'CUTTING - BAND SAW', 'CUTTING - CIRCULAR', 'GRINDING CUTTING', 'FORGING HAMMER 1 (HAMMER)', 'FORGING HAMMER 2 (HAMMER)', 'FORGING HAMMER 3 (HAMMER)', 'FORGING PRESS 4 (PRESS)', 'FORGING HAMMER 5 (HAMMER)', 'FORGING PRESS 6 (PRESS)', 'FORGING PRESS 7 (PRESS)', 'FORGING PRESS 8 (PRESS)', 'FORGING HAMMER 9 (HAMMER)', 'FORGING PRESS 10 (PRESS)', 'FORGING PRESS 11', 'GRINDING', 'SHOT BLASTING', 'HEAT TREATMENT/TEMPERING', 'HEAT TREATMENT NORMALIZING/QUENCHING', 'DRILLING HOOK FRONT', 'COINING', 'MAGNA FLUX', 'LINE VISUAL', 'ANTIRUST PROTECTION & QUALITY INSPECTION', 'NON AKTIF-EX MCH UB09', 'MACHINING BORING 1', 'MACHINING FLEXIBLE LINE', 'MACHINING SPLINE HUB - TURNING', 'MACHINING SPLINE HUB - BROACHING', 'LINE STAMPING PRESS-HUB CLUTCH', 'STEERING STEM - MCH UNDER BRACKET &UB09', 'STEERING STEM - MACHINING SHAFT', 'STEERING STEM - ASSY SHAFT', 'STEERING STEM-ASSY CONERACE', 'MACH CONRACE & BALLRACE - ROUGH', 'FORMING CONRACE', 'MACHINGING -CONRACE FINISH', 'MACHINING-BALLRACE FINISH', 'MACHINING ROTOR', 'MACHINING BOSS ROTOR KWWX/05A', 'MACHINING BOSS ROTOR 05K', 'MACHINING BOSS ROTOR KWWX/05A-BROACHING', 'MACHINING BOSS ROTOR 05K-BROACHING', 'MACHINING LOWER BALL JOINT LINE 1', 'MACHINING LOWER BALL JOINT LINE 2', 'MACHINING - HUB FRONT D80', 'MACHINING - HUB FRONT K2', 'MACHINING - HUB FRONT 2CF-2MD', 'MACHINING - SPINDLE', 'MACHINING SPINDLE ADM', 'MACHINING - ARM CUSHION', 'MACHINING-ASSY ARM CUSHION', 'NON AKTIF-LINE AFT MARKET BURNISHING', 'LINE AFT MARKET MACH FIN CONROD', 'LINE AFT MARKET CTRLESS GRIND PIN PISTON', 'NON AKTIF-LINE AFT MKT MCH PIN CRANK 2R', 'LINE AFT MARKET CUT & CHAMFER PIN PISTON', 'LINE AFT MARKET ASSY TIE ROD/BALLJOINT', 'LABOR ASSY/PACKING CONROD & PISTON', 'MACHINING CONROD KZRA - ROUGH', 'MACHINING CONROD KZRA - TEMPERING', 'MACHINING CONROD KZRA - FINISHING', 'LINE JACK - LOKAL M/C ROLLING THREAD', 'LINE JACK - LOKAL CUT/TURN PG/RG/OT/SS', 'LINE JACK - GRINDING & CHAMPER', 'LINE JACK - WELDING SCREW SHAFT PJ', 'LINE JACK - ASSY JACK PJ - WIP', 'LINE JACK - ASSY JACK SJ', 'LINE JACK - ASSY JACK PJ - FG', 'ASSY CHAIN-WINCH', 'LINE JACK - STAMPING PRESS LINE JACK', 'LINE JACK-STAMPING PROGRESIF', 'NON AKTIF-LINE PACKING JACK', 'LABOR PAINTING JACK', 'NON AKTIF-JOINT KICK STARTER SPORT', 'NON AKTIF-ARM KICK STARTER SPORT', 'MACHINING-ARM KICKSTARTERCUB/MATIC/SPORT', 'MACHINING - LEVER KICK STARTER CUB/MATIC', 'LABOR ASSY KICK STARTER', 'MACHINING - ARM KICK STARTER YAMAHA', 'MACHINING - LEVER KICK STARTER YAMAHA', 'LINE TOOLS - UPSETTER & FORMING TW', 'LINE TOOLS - SANDRING TW & HN', 'LINE TOOLS - MACHINING - TW', 'LINE TOOLS - STAMPING PRESS', 'LINE TOOLS - UPSETTER & FORMING -HUB NUT', 'LINE TOOLS - MACHINING - HUB NUT', 'LINE TOOLS - LABOR ASSY/PACKING'];

const { Title } = Typography;

const StandardCostMaster: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAccounting = user?.role === 'accounting';

  const [data, setData] = useState<StandardCostMasterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getStandardCostMaster();
      setData(res || []);
    } catch (e: any) {
      notification.error({ message: 'Error loading data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      valid_from: '2024-01-01',
      is_active: true,
      labor: 0,
      mdepr: 0,
      fd: 0,
      fi: 0,
      vd: 0,
      vi: 0
    });
    setModalVisible(true);
  };

  const handleEdit = (record: StandardCostMasterRow) => {
    setEditingId(record.id);
    form.setFieldsValue({
      ...record,
      is_active: record.is_active === 1 || record.is_active === true
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteStandardCostMaster(id);
      notification.success({ message: 'Deleted successfully' });
      fetchData();
    } catch (err: any) {
      notification.error({ message: 'Failed to delete' });
    }
  };

  const handleSave = async (values: any) => {
    try {
      if (editingId) {
        await updateStandardCostMaster(editingId, values as StandardCostPayload);
        notification.success({ message: 'Updated successfully' });
      } else {
        await createStandardCostMaster(values as StandardCostPayload);
        notification.success({ message: 'Created successfully' });
      }
      setModalVisible(false);
      fetchData();
    } catch (err: any) {
      notification.error({ message: 'Failed to save' });
    }
  };

  const columns = [
    { title: 'Cost Center', dataIndex: 'cost_center', key: 'cost_center' },
    { title: 'Work Center (WC)', dataIndex: 'wc', key: 'wc' },
    { title: 'Labor', dataIndex: 'labor', key: 'labor' },
    { title: 'Mdepr', dataIndex: 'mdepr', key: 'mdepr' },
    { title: 'FD', dataIndex: 'fd', key: 'fd' },
    { title: 'FI', dataIndex: 'fi', key: 'fi' },
    { title: 'VD', dataIndex: 'vd', key: 'vd' },
    { title: 'VI', dataIndex: 'vi', key: 'vi' },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (v: any) => (v === 1 || v === true ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag>)
    },
  ];

  if (isAccounting) {
    columns.push({
      title: 'Action',
      key: 'action',
      render: (_: any, record: StandardCostMasterRow) => (
        <Space size="middle">
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="Delete this item?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    } as any);
  }

  return (
    <div style={{ padding: 24, maxWidth: '100%', overflowX: 'auto' }}>
      <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ marginBottom: 0 }}>Standard Cost Master</Title>
          <div style={{ color: '#6b7280', fontSize: 13 }}>Tambah, edit, dan hapus baris master cost center / work center untuk dipakai di perhitungan Standard Cost.</div>
        </div>
        <Space>
          <Button onClick={() => navigate('/main/standard-cost')}>
            Kembali ke Standard Cost
          </Button>
          {isAccounting && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              Tambah Data
            </Button>
          )}
        </Space>
      </div>

      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        loading={loading}
        bordered
        size="small"
        pagination={{ pageSize: 15 }}
      />

      <Modal
        title={editingId ? 'Edit Standard Cost' : 'Add Standard Cost'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="cost_center" label="Cost Center" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="wc" label="Work Center (WC)" rules={[{ required: true }]}>
            <Select showSearch>
              {wcOptions.map(opt => <Select.Option key={opt} value={opt}>{opt}</Select.Option>)}
            </Select>
          </Form.Item>
          <Space>
            <Form.Item name="labor" label="Labor"><InputNumber min={0} step={0.01} /></Form.Item>
            <Form.Item name="mdepr" label="Mdepr"><InputNumber min={0} step={0.01} /></Form.Item>
            <Form.Item name="fd" label="FD"><InputNumber min={0} step={0.01} /></Form.Item>
          </Space>
          <Space>
            <Form.Item name="fi" label="FI"><InputNumber min={0} step={0.01} /></Form.Item>
            <Form.Item name="vd" label="VD"><InputNumber min={0} step={0.01} /></Form.Item>
            <Form.Item name="vi" label="VI"><InputNumber min={0} step={0.01} /></Form.Item>
          </Space>
          <Form.Item name="valid_from" label="Valid From">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="valid_to" label="Valid To">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="is_active" label="Is Active">
            <Select disabled={!isAccounting}>
              <Select.Option value={true}>Active</Select.Option>
              <Select.Option value={false}>Inactive</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StandardCostMaster;
