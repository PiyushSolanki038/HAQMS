const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/appointments
// FIX: Replaced N+1 loop queries with a single query using Prisma include
router.get('/', authenticate, async (req, res) => {
  try {
    const { doctorId, status } = req.query;

    const where = {};
    if (doctorId) where.doctorId = doctorId;
    if (status) where.status = status;

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { appointmentDate: 'asc' },
      include: {
        patient: {
          select: { id: true, name: true, phoneNumber: true, age: true, medicalHistory: true },
        },
        doctor: {
          select: { id: true, name: true, specialization: true },
        },
      },
    });

    res.json({
      success: true,
      count: appointments.length,
      appointments,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve appointments.' });
  }
});

// POST /api/appointments
// FIX: Improved double-booking check to block appointments within the same 1-hour window
router.post('/', authenticate, async (req, res) => {
  try {
    const { patientId, doctorId, appointmentDate, reason } = req.body;

    if (!patientId || !doctorId || !appointmentDate) {
      return res.status(400).json({ error: 'Patient, Doctor, and Appointment Date are required.' });
    }

    const appDate = new Date(appointmentDate);

    // Block bookings within a 60-minute window of an existing appointment
    const windowStart = new Date(appDate.getTime() - 60 * 60 * 1000);
    const windowEnd = new Date(appDate.getTime() + 60 * 60 * 1000);

    const existingBooking = await prisma.appointment.findFirst({
      where: {
        doctorId,
        appointmentDate: { gte: windowStart, lte: windowEnd },
        status: { not: 'CANCELLED' },
      },
    });

    if (existingBooking) {
      return res.status(400).json({
        error: 'Doctor already has an appointment within this 1-hour time window.',
      });
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        appointmentDate: appDate,
        reason: reason || '',
        status: 'PENDING',
      },
    });

    res.status(201).json({
      message: 'Appointment booked successfully',
      appointment,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to book appointment.' });
  }
});

// PATCH /api/appointments/:id
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update appointment.' });
  }
});

module.exports = router;
