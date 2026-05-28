const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/reports/doctor-stats
// FIX: Replaced nested sequential loop with parallel Promise.all queries per doctor,
// and removed the artificial 80ms delay per doctor.
router.get('/doctor-stats', authenticate, async (req, res) => {
  try {
    const start = Date.now();

    const doctors = await prisma.doctor.findMany();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Run all doctor stat queries in parallel instead of sequentially
    const reportData = await Promise.all(
      doctors.map(async (doc) => {
        const [totalAppointments, completedAppointments, cancelledAppointments, queueTokensCount] =
          await Promise.all([
            prisma.appointment.count({ where: { doctorId: doc.id } }),
            prisma.appointment.count({ where: { doctorId: doc.id, status: 'COMPLETED' } }),
            prisma.appointment.count({ where: { doctorId: doc.id, status: 'CANCELLED' } }),
            prisma.queueToken.count({
              where: { doctorId: doc.id, createdAt: { gte: today } },
            }),
          ]);

        // Revenue = completed appointments × consultation fee
        const revenue = completedAppointments * doc.consultationFee;

        return {
          id: doc.id,
          name: doc.name,
          specialization: doc.specialization,
          department: doc.department,
          totalAppointments,
          completedAppointments,
          cancelledAppointments,
          todayQueueSize: queueTokensCount,
          revenue,
        };
      })
    );

    const durationMs = Date.now() - start;

    res.json({
      success: true,
      timeTakenMs: durationMs,
      data: reportData,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

module.exports = router;
