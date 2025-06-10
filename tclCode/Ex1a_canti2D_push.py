# --------------------------------------------------------------------------------------------------
# Example 1. cantilever 2D
# static pushover analysis with gravity.
# all units are in kip, inch, second
# elasticBeamColumn ELEMENT
#			Silvia Mazzoni & Frank McKenna, 2006
#
#    ^Y
#    |
#    2       __ 
#    |         | 
#    |         | 
#    |         | 
#  (1)      36'
#    |         | 
#    |         | 
#    |         | 
#  =1=    ----  -------->X
#

# SET UP ----------------------------------------------------------------------------
from openseespy.opensees import *
import numpy as np
wipe()						# clear opensees model
model('basic','-ndm',2,'-ndf',3)			# 2 dimensions, 3 dof per node
 

# define GEOMETRY -------------------------------------------------------------
# nodal coordinates:
# node#, X Y
node(1,0,0)
node(2,0,432)


# Single point constraints -- Boundary Conditions
  			# node DX DY RZ
fix(1,1,1,1)
# nodal masses:
 					# node#, Mx My Mz, Mass=Weight/g.
mass(2,5.18,1.e-9,0)
# Define ELEMENTS -------------------------------------------------------------
# define geometric transformation: performs a linear geometric transformation of beam stiffness and resisting force from the basic system to the global-coordinate system
  		# associate a tag to transformation
geomTransf('Linear',1)
# connectivity: (make A very large, 10e6 times its actual value)
 	# element elasticBeamColumn $eleTag $iNode $jNode $A $E $Iz $transfTag
el
# Define RECORDERS -------------------------------------------------------------
 
# define GRAVITY -------------------------------------------------------------
 
    			# node#, FX FY MZ --  superstructure-weight

      				# how it handles boundary conditions
 					# renumber dof's to minimize band-width (optimization), if you want to
 			# how to store and solve the system of equations in the analysis
  				# determine if convergence has been achieved at the end of an iteration step
 			# use Newton's solution algorithm: updates tangent stiffness at every iteration
 				# determine the next time step for an analysis, # apply gravity in 10 steps
 			# define type of analysis static or transient
  				# perform gravity analysis
 			# hold gravity constant and restart time

# define LATERAL load -------------------------------------------------------------
# Lateral load pattern		# node#, FX FY MZ -- representative lateral load at top node


# pushover: diplacement controlled static analysis
	# switch to displacement control, for node 11, dof 1, 0.1 increment
			# apply 100 steps of pushover analysis to a displacement of 10





