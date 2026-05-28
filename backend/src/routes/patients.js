const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorizeAdminOnlyLegacy } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/patients
// FIX: Replaced in-memory pagination/filter with proper SQL WHERE + LIMIT/OFFSET
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, gender } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;

    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (gender && gender !== 'All') {
      where.gender = { equals: gender, mode: 'insensitive' };
    }

    const [totalPatients, patients] = await Promise.all([
      prisma.patient.count({ where }),
      prisma.patient.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(totalPatients / limit);

    res.json({
      success: true,
      patients,
      pagination: {
        page,
        limit,
        totalPatients,
        totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch patients.' });
  }
});

// GET /api/patients/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id },
      include: { appointments: true },
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(patient);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve patient.' });
  }
});

// POST /api/patients
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, email, phoneNumber, age, gender, medicalHistory } = req.body;

    if (!name || !phoneNumber || !age || !gender) {
      return res.status(400).json({ error: 'Name, phoneNumber, age, and gender are required.' });
    }

    // FIX: Validate phone number — must be digits only, 7-15 chars
    const phoneRegex = /^\+?[\d\s\-]{7,15}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({ error: 'Invalid phone number format.' });
    }

    const parsedAge = parseInt(age);
    if (isNaN(parsedAge) || parsedAge < 0 || parsedAge > 150) {
      return res.status(400).json({ error: 'Age must be a valid number between 0 and 150.' });
    }

    const patient = await prisma.patient.create({
      data: {
        name,
        email: email || null,
        phoneNumber,
        age: parsedAge,
        gender,
        medicalHistory: medicalHistory || null,
      },
    });

    res.status(201).json(patient);
  } catch (error) {
    res.status(500).json({ error: 'Failed to register patient.' });
  }
});

// DELETE /api/patients/:id
// FIX: authorizeAdminOnlyLegacy now properly checks for ADMIN role
router.delete('/:id', authenticate, authorizeAdminOnlyLegacy, async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    await prisma.patient.delete({ where: { id } });

    res.json({ message: `Successfully deleted patient ${patient.name}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete patient.' });
  }
});

module.exports = router;
